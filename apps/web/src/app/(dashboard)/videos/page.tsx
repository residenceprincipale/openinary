import dynamic from "next/dynamic";
import { GetStartedPage } from "@openinary/dashboard";

// Same split as Images: the player and demo clips load with the page body.
const VideosPlayground = dynamic(() =>
  import("@openinary/dashboard").then((mod) => mod.VideosPlayground),
);

export default function Page() {
  return (
    <GetStartedPage
      title="Videos"
      heading="Optimize & deliver videos"
      description="The same URL grammar as images, plus a few keys of its own: trim a clip by seconds, pull a poster frame, or serve a lighter rendition to smaller screens."
    >
      <VideosPlayground />
    </GetStartedPage>
  );
}
