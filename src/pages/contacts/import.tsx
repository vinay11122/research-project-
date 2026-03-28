import { useState } from "react";
import ImportUploader from "@/components/imports/ImportUploader";
import ImportPreview from "@/components/imports/ImportPreview";
import PageShell from "@/components/layout/PageShell";

export default function ContactImportPage() {
  const [preview, setPreview] = useState<any | null>(null);

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Import Contacts</h1>

        <ImportUploader onPreview={setPreview} />
        <ImportPreview preview={preview} />
      </div>
    </PageShell>
  );
}
