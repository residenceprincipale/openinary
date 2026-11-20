import dynamic from "next/dynamic";
import { GetStartedPage } from "@openinary/dashboard";

// The comparison playground pulls in canvas, demo assets and copy helpers;
// keep it out of the initial dashboard bundle.
const ImagesPlayground = dynamic(() =>
  import("@openinary/dashboard").then((mod) => mod.ImagesPlayground),
);

export default function Page() {
  return (
    <GetStartedPage
      title="Images"
      heading="Optimize & deliver images"
      description="Every file you upload is served straight from your instance. Add a transformation to the URL and Openinary resizes, crops and re-encodes it on the fly - no pre-generated variants to manage."
    >
      <ImagesPlayground />
    </GetStartedPage>
  );
}
