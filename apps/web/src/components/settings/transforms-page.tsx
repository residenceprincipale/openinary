"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Input,
  SettingsField,
  SettingsFields,
  SettingsSection,
  useOpeninary,
} from "@openinary/ui";
import { toast } from "sonner";

type TransformConfig = {
  image: {
    quality: number;
    format: string;
    crop: string;
    gravity: string;
  };
  video: {
    quality: number;
    format: string;
    autoDownscale: boolean;
    autoDownscaleResolution: number;
  };
  branding: { title: string; logoUrl: string };
};

const CROPS = ["fill", "fit", "scale", "crop", "pad"];
const GRAVITIES = ["center", "north", "south", "east", "west", "face", "auto"];

const FIELD =
  "h-8 w-full rounded-[8px] border border-ds-border-strong bg-ds-field px-2.5 text-[13px] text-ds-text outline-none";

/**
 * Encode defaults applied when a URL does not name them. Saved to
 * data/transforms.json; the API reads it per request through a getter.
 */
export function TransformsPage() {
  const { apiBaseUrl, fetch } = useOpeninary();
  const [config, setConfig] = useState<TransformConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch(`${apiBaseUrl}/config/transforms`)
      .then((res) => res.json())
      .then((json) => setConfig(json.data))
      .catch(() => toast.error("Failed to load transformation defaults"));
  }, [apiBaseUrl, fetch]);

  if (!config) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const update = <K extends keyof TransformConfig>(
    section: K,
    patch: Partial<TransformConfig[K]>,
  ) =>
    setConfig((current) =>
      current
        ? { ...current, [section]: { ...current[section], ...patch } }
        : current,
    );

  const save = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/config/transforms`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Transformation defaults saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Images"
        description="Defaults for image URLs that do not set q_, c_ or g_."
      >
        <SettingsFields>
          <SettingsField label="Quality (1-100)">
            <Input
              type="number"
              min={1}
              max={100}
              value={config.image.quality}
              onChange={(event) =>
                update("image", { quality: Number(event.target.value) })
              }
            />
          </SettingsField>
          <SettingsField label="Crop mode">
            <select
              className={FIELD}
              value={config.image.crop}
              onChange={(event) => update("image", { crop: event.target.value })}
            >
              {CROPS.map((crop) => (
                <option key={crop} value={crop}>
                  {crop}
                </option>
              ))}
            </select>
          </SettingsField>
          <SettingsField label="Gravity">
            <select
              className={FIELD}
              value={config.image.gravity}
              onChange={(event) =>
                update("image", { gravity: event.target.value })
              }
            >
              {GRAVITIES.map((gravity) => (
                <option key={gravity} value={gravity}>
                  {gravity}
                </option>
              ))}
            </select>
          </SettingsField>
        </SettingsFields>
      </SettingsSection>

      <SettingsSection
        title="Videos"
        description="Defaults for video transcodes that do not set q_."
      >
        <SettingsFields>
          <SettingsField label="Quality (1-100)">
            <Input
              type="number"
              min={1}
              max={100}
              value={config.video.quality}
              onChange={(event) =>
                update("video", { quality: Number(event.target.value) })
              }
            />
          </SettingsField>
          <SettingsField
            label="Auto-downscale to 720p"
            hint="Large videos are shrunk before encoding unless the URL sets w_ or h_."
          >
            <select
              className={FIELD}
              value={config.video.autoDownscale ? "on" : "off"}
              onChange={(event) =>
                update("video", { autoDownscale: event.target.value === "on" })
              }
            >
              <option value="on">Enabled</option>
              <option value="off">Disabled</option>
            </select>
          </SettingsField>
        </SettingsFields>
      </SettingsSection>

      <SettingsSection
        title="Branding"
        description="The name and logo the dashboard shows. No effect on delivery URLs."
      >
        <SettingsFields>
          <SettingsField label="Title">
            <Input
              value={config.branding.title}
              onChange={(event) =>
                update("branding", { title: event.target.value })
              }
            />
          </SettingsField>
          <SettingsField label="Logo URL">
            <Input
              value={config.branding.logoUrl}
              onChange={(event) =>
                update("branding", { logoUrl: event.target.value })
              }
              placeholder="https://example.com/logo.svg"
            />
          </SettingsField>
        </SettingsFields>
      </SettingsSection>

      <div className="flex justify-end">
        <Button onClick={save} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save defaults"}
        </Button>
      </div>
    </div>
  );
}
