import { useState } from "react";
import { previewContactImport } from "@/lib/api/imports";

export default function ImportUploader({ onPreview }: { onPreview: (data: any) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const data = await previewContactImport(file);
      onPreview(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded p-4 space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Select File</label>
        <input
          type="file"
          accept=".csv, .xlsx, .xls, .pdf, .docx, .doc"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-slate-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-indigo-50 file:text-indigo-700
            hover:file:bg-indigo-100"
        />
        <p className="text-xs text-gray-500">
          Supported formats: CSV, Excel (.xlsx, .xls), PDF, Word (.docx)
        </p>
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Processing..." : "Preview Import"}
      </button>

      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
