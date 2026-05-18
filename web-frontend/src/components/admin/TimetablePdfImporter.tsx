'use client';

import { ChangeEvent, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ClassInfo, Course, User } from '@/types';
import { bestMatch, parseTimetableText, ParsedRow } from '@/lib/timetable-parser';
import { Upload, FileText, X, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  classes: ClassInfo[];
  teachers: (User & { id: string })[];
  courses: Course[];
  onImported: () => void;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Editable row in the review table — extends ParsedRow with the resolved IDs
// the admin picks (or that fuzzy-matching pre-fills).
interface ReviewRow extends ParsedRow {
  id: string; // local row id
  teacherId: string;
  classId: string;
  courseId: string;
  error?: string;
  submitState?: 'idle' | 'submitting' | 'created' | 'failed';
  submitMessage?: string;
}

type Stage = 'idle' | 'extracting' | 'review' | 'submitting' | 'done';

const renderPdfPagesToImages = async (file: File, onProgress: (p: string) => void): Promise<string[]> => {
  onProgress('Loading PDF library…');
  const pdfjs = await import('pdfjs-dist');
  // Pull the worker from a CDN, version-pinned to whatever pdfjs-dist resolved to.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  const images: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress(`Rendering page ${i} of ${pdf.numPages}…`);
    const page = await pdf.getPage(i);
    // 2.0 scale roughly = 200 DPI; balances OCR accuracy vs memory.
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL('image/png'));
  }

  return images;
};

const ocrImages = async (images: string[], onProgress: (p: string) => void): Promise<string> => {
  onProgress('Loading OCR engine…');
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', undefined, {
    logger: () => {
      // intentionally quiet — we surface our own per-page progress below
    },
  });

  let combined = '';
  for (let i = 0; i < images.length; i++) {
    onProgress(`Reading text from page ${i + 1} of ${images.length}…`);
    const result = await worker.recognize(images[i]);
    combined += result.data.text + '\n';
  }
  await worker.terminate();
  return combined;
};

export default function TimetablePdfImporter({
  open,
  onClose,
  classes,
  teachers,
  courses,
  onImported,
}: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState('');
  const [defaultClassId, setDefaultClassId] = useState('');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const reset = () => {
    setStage('idle');
    setProgress('');
    setRows([]);
    setDefaultClassId('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    if (stage === 'extracting' || stage === 'submitting') {
      if (!confirm('A job is still running. Close anyway?')) return;
    }
    reset();
    onClose();
  };

  const buildReviewRows = (parsed: ParsedRow[]): ReviewRow[] => {
    return parsed.map((p, idx) => {
      const courseMatch = bestMatch(
        p.courseHint,
        courses,
        (c) => `${c.code} ${c.name}`,
        0.3
      );
      const teacherMatch = bestMatch(
        p.teacherHint,
        teachers,
        (t) => t.displayName,
        0.34
      );
      return {
        ...p,
        id: `row-${idx}`,
        teacherId: teacherMatch?.item.id || '',
        classId: defaultClassId,
        courseId: courseMatch?.item.id || '',
        submitState: 'idle',
      };
    });
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStage('extracting');
    setRows([]);
    try {
      const images = await renderPdfPagesToImages(file, setProgress);
      const text = await ocrImages(images, setProgress);
      setProgress('Parsing extracted text…');
      const parsed = parseTimetableText(text);
      if (parsed.length === 0) {
        toast.error('Could not find any time slots in the PDF. Try a clearer scan or add rows manually.');
        setStage('idle');
        return;
      }
      setRows(buildReviewRows(parsed));
      setStage('review');
      toast.success(`Extracted ${parsed.length} candidate row(s). Review and fix before importing.`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'PDF extraction failed');
      setStage('idle');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const updateRow = (id: string, patch: Partial<ReviewRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const validateRow = (r: ReviewRow): string | undefined => {
    if (r.dayOfWeek < 0 || r.dayOfWeek > 6) return 'Pick a day';
    if (!/^\d{2}:\d{2}$/.test(r.startTime)) return 'Bad start time';
    if (!/^\d{2}:\d{2}$/.test(r.endTime)) return 'Bad end time';
    if (r.startTime >= r.endTime) return 'End must be after start';
    if (!r.teacherId) return 'Pick a teacher';
    if (!r.classId) return 'Pick a class';
    if (!r.courseId) return 'Pick a course';
    if (!r.room.trim()) return 'Room required';
    return undefined;
  };

  const validRows = rows.map((r) => ({ ...r, error: validateRow(r) }));
  const readyCount = validRows.filter((r) => !r.error).length;

  const submitAll = async () => {
    const toSubmit = validRows.filter((r) => !r.error);
    if (toSubmit.length === 0) {
      toast.error('No rows ready to import. Fix the highlighted fields first.');
      return;
    }

    setStage('submitting');
    let created = 0;
    let failed = 0;

    for (const row of toSubmit) {
      updateRow(row.id, { submitState: 'submitting', submitMessage: undefined });
      try {
        await api.post('/admin/timetables', {
          teacherId: row.teacherId,
          classId: row.classId,
          courseId: row.courseId,
          dayOfWeek: row.dayOfWeek,
          startTime: row.startTime,
          endTime: row.endTime,
          room: row.room,
        });
        updateRow(row.id, { submitState: 'created' });
        created += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed';
        updateRow(row.id, { submitState: 'failed', submitMessage: message });
        failed += 1;
      }
    }

    setStage('done');
    toast.success(`Imported ${created} row(s)${failed > 0 ? `, ${failed} failed (likely conflicts)` : ''}`);
    if (created > 0) onImported();
  };

  // Re-apply defaultClassId to rows whose classId is empty (admin may set it after extraction)
  const applyDefaultClass = (id: string) => {
    setDefaultClassId(id);
    setRows((prev) => prev.map((r) => (r.classId ? r : { ...r, classId: id })));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-6xl w-full mx-4 max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Import Timetable from PDF</h3>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {stage === 'idle' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900 space-y-1">
              <p className="font-medium">How it works</p>
              <ol className="list-decimal list-inside text-xs space-y-1">
                <li>Upload the timetable PDF (printed/digital PDFs work best; scans must be clear).</li>
                <li>The system renders each page, runs OCR locally in your browser, and looks for time slots.</li>
                <li>Review the extracted rows, fix anything OCR got wrong, then import.</li>
              </ol>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Class (applied to all rows initially)
              </label>
              <select
                value={defaultClassId}
                onChange={(e) => setDefaultClassId(e.target.value)}
                className="input-field"
              >
                <option value="">(set per row)</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — Section {c.section} (Sem {c.semester})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                OCR can&apos;t reliably tell which class a row belongs to. Pre-selecting one saves clicks; you can still override per row.
              </p>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              onChange={handleFile}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="btn-primary flex items-center gap-2"
            >
              <Upload className="w-4 h-4" /> Choose PDF file
            </button>
          </div>
        )}

        {stage === 'extracting' && (
          <div className="py-10 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-gray-700">{progress}</p>
            <p className="text-xs text-gray-400 max-w-md text-center">
              The OCR engine downloads ~10 MB the first time. Subsequent runs are faster.
            </p>
          </div>
        )}

        {(stage === 'review' || stage === 'submitting' || stage === 'done') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="text-gray-700">{rows.length} row(s) extracted —</span>{' '}
                <span className="text-green-700 font-medium">{readyCount} ready</span>
                {rows.length - readyCount > 0 && (
                  <>
                    , <span className="text-red-700 font-medium">{rows.length - readyCount} need fixing</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Default class:</label>
                <select
                  value={defaultClassId}
                  onChange={(e) => applyDefaultClass(e.target.value)}
                  className="input-field text-xs py-1 px-2"
                >
                  <option value="">(none)</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} — {c.section}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-auto max-h-[55vh]">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Day</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Start</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">End</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Course</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Teacher</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Class</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Room</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {validRows.map((row) => {
                    const isCreated = row.submitState === 'created';
                    const isFailed = row.submitState === 'failed';
                    const rowBg = isCreated
                      ? 'bg-green-50'
                      : isFailed
                        ? 'bg-red-50'
                        : row.error
                          ? 'bg-amber-50'
                          : '';
                    return (
                      <tr key={row.id} className={`border-t align-top ${rowBg}`}>
                        <td className="py-1.5 px-1.5">
                          <select
                            value={row.dayOfWeek}
                            onChange={(e) => updateRow(row.id, { dayOfWeek: parseInt(e.target.value) })}
                            className="text-xs border rounded px-1 py-0.5 w-full"
                            disabled={isCreated}
                          >
                            <option value={-1}>—</option>
                            {DAYS.map((d, i) => (
                              <option key={i} value={i}>{d.slice(0, 3)}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 px-1.5">
                          <input
                            type="time"
                            value={row.startTime}
                            onChange={(e) => updateRow(row.id, { startTime: e.target.value })}
                            className="text-xs border rounded px-1 py-0.5 w-full"
                            disabled={isCreated}
                          />
                        </td>
                        <td className="py-1.5 px-1.5">
                          <input
                            type="time"
                            value={row.endTime}
                            onChange={(e) => updateRow(row.id, { endTime: e.target.value })}
                            className="text-xs border rounded px-1 py-0.5 w-full"
                            disabled={isCreated}
                          />
                        </td>
                        <td className="py-1.5 px-1.5">
                          <select
                            value={row.courseId}
                            onChange={(e) => updateRow(row.id, { courseId: e.target.value })}
                            className="text-xs border rounded px-1 py-0.5 w-full"
                            disabled={isCreated}
                          >
                            <option value="">— pick course —</option>
                            {courses.map((c) => (
                              <option key={c.id} value={c.id}>{c.code} {c.name}</option>
                            ))}
                          </select>
                          {row.courseHint && (
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate" title={row.courseHint}>
                              OCR: {row.courseHint}
                            </p>
                          )}
                        </td>
                        <td className="py-1.5 px-1.5">
                          <select
                            value={row.teacherId}
                            onChange={(e) => updateRow(row.id, { teacherId: e.target.value })}
                            className="text-xs border rounded px-1 py-0.5 w-full"
                            disabled={isCreated}
                          >
                            <option value="">— pick teacher —</option>
                            {teachers.map((t) => (
                              <option key={t.id} value={t.id}>{t.displayName}</option>
                            ))}
                          </select>
                          {row.teacherHint && (
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate" title={row.teacherHint}>
                              OCR: {row.teacherHint}
                            </p>
                          )}
                        </td>
                        <td className="py-1.5 px-1.5">
                          <select
                            value={row.classId}
                            onChange={(e) => updateRow(row.id, { classId: e.target.value })}
                            className="text-xs border rounded px-1 py-0.5 w-full"
                            disabled={isCreated}
                          >
                            <option value="">— pick class —</option>
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>{c.name} ({c.section})</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 px-1.5">
                          <input
                            type="text"
                            value={row.room}
                            onChange={(e) => updateRow(row.id, { room: e.target.value })}
                            className="text-xs border rounded px-1 py-0.5 w-full"
                            disabled={isCreated}
                          />
                        </td>
                        <td className="py-1.5 px-1.5 text-xs">
                          {row.submitState === 'submitting' && (
                            <span className="text-gray-500 flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> sending
                            </span>
                          )}
                          {isCreated && (
                            <span className="text-green-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> created
                            </span>
                          )}
                          {isFailed && (
                            <span className="text-red-700 flex items-center gap-1" title={row.submitMessage}>
                              <AlertTriangle className="w-3 h-3" /> failed
                            </span>
                          )}
                          {!row.submitState || row.submitState === 'idle' ? (
                            row.error ? (
                              <span className="text-amber-700">{row.error}</span>
                            ) : (
                              <span className="text-green-700">ready</span>
                            )
                          ) : null}
                        </td>
                        <td className="py-1.5 px-1.5">
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            disabled={isCreated || row.submitState === 'submitting'}
                            className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30"
                            title="Drop this row"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={handleClose} className="btn-secondary flex-1">
                {stage === 'done' ? 'Close' : 'Cancel'}
              </button>
              {stage !== 'done' && (
                <button
                  onClick={submitAll}
                  disabled={readyCount === 0 || stage === 'submitting'}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {stage === 'submitting'
                    ? 'Importing…'
                    : `Import ${readyCount} row(s)`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
