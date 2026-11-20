"use client";

import { useState } from "react";
import { encodePath, toAbsoluteUrl } from "../lib/utils";
import { useOpeninary } from "../provider/openinary-provider";
import { Input } from "../ui/input";
import type { MediaFile } from "../types";
import { CopyButton, DetailsCard } from "./delivery-url";

const FORMATS = ["mp3", "m4a", "aac", "ogg", "wav", "flac"] as const;

type Params = {
  format: string;
  quality: string;
  volume: string;
  start: string;
  end: string;
};

const serialize = (params: Params) =>
  [
    params.start !== "" && `so_${params.start}`,
    params.end !== "" && `eo_${params.end}`,
    params.volume !== "" && `v_${params.volume}`,
    params.quality !== "" && `q_${params.quality}`,
    params.format !== "mp3" && `f_${params.format}`,
  ]
    .filter(Boolean)
    .join(",");

const FIELD =
  "h-8 w-full rounded-[8px] border border-ds-border-strong bg-ds-field px-2.5 text-[13px] text-ds-text outline-none";

/** Audio transcode settings: format, bitrate, volume and trim. */
export function AssetAudioTab({
  asset,
  transformBaseUrl,
}: {
  asset: MediaFile;
  transformBaseUrl: string | null;
}) {
  const { apiBaseUrl } = useOpeninary();
  const [params, setParams] = useState<Params>({
    format: "mp3",
    quality: "128",
    volume: "",
    start: "",
    end: "",
  });
  const set = (key: keyof Params) => (value: string) =>
    setParams((current) => ({ ...current, [key]: value }));

  const segment = serialize(params);
  const path = encodePath(asset.path);
  const url =
    transformBaseUrl === null
      ? ""
      : toAbsoluteUrl(`${transformBaseUrl}/t/${segment ? `${segment}/` : ""}${path}`);
  // The original, so the preview keeps working if a combination fails.
  const original = `${apiBaseUrl}/download/${path}`;

  return (
    <div className="space-y-3">
      <DetailsCard title="Preview" description="Applied by the server on the next request.">
        <audio src={url || original} controls className="w-full" />
      </DetailsCard>

      <DetailsCard title="Delivery URL">
        <p className="break-all rounded-[8px] border border-ds-border bg-ds-field p-2 font-mono text-[11px]">
          {url}
        </p>
        <CopyButton value={url} className="w-full" />
      </DetailsCard>

      <DetailsCard title="Encode">
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-[12px] text-ds-muted">
            <span>Format</span>
            <select
              className={FIELD}
              value={params.format}
              onChange={(event) => set("format")(event.target.value)}
            >
              {FORMATS.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[12px] text-ds-muted">
            <span>Bitrate (kbps)</span>
            <Input
              type="number"
              min={32}
              max={320}
              value={params.quality}
              onChange={(event) => set("quality")(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-[12px] text-ds-muted">
            <span>Trim start (s)</span>
            <Input
              type="number"
              min={0}
              value={params.start}
              onChange={(event) => set("start")(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-[12px] text-ds-muted">
            <span>Trim end (s)</span>
            <Input
              type="number"
              min={0}
              value={params.end}
              onChange={(event) => set("end")(event.target.value)}
            />
          </label>
          <label className="col-span-2 space-y-1 text-[12px] text-ds-muted">
            <span>Volume (0-100, empty = unchanged)</span>
            <Input
              type="number"
              min={0}
              max={100}
              value={params.volume}
              onChange={(event) => set("volume")(event.target.value)}
            />
          </label>
        </div>
      </DetailsCard>
    </div>
  );
}
