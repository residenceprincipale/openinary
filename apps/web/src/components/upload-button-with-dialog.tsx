import { Upload } from "lucide-react";
import DefaultDialog from "./default-dialog";
import { UploadSection } from "./upload-section";
import { Button } from "./ui/button";

export default function UploadButtonWithDialog({
  uploadToFolder,
  isOpen,
  onClose,
}: {
  uploadToFolder?: string;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  return (
    <DefaultDialog
      title={`Upload Files ${uploadToFolder ? `to '${uploadToFolder}'` : ""}`}
      isOpen={isOpen}
      onClose={onClose}
      trigger={
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      }
    >
      <UploadSection uploadToFolder={uploadToFolder} />
    </DefaultDialog>
  );
}
