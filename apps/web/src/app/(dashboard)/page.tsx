import { AssetsView } from "@openinary/dashboard";
import { UploadButtonWithDialog } from "@openinary/ui";
import { Suspense } from "react";

export default function HomePage() {
  return (
    <Suspense>
      <AssetsView
        emptyActions={<UploadButtonWithDialog />}
        emptyFooter={false}
      />
    </Suspense>
  );
}
