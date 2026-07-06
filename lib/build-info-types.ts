export interface ChangelogEntry {
  sha: string;
  date: string;
  title: string;
  highlights: string[];
}

export interface VersionsFile {
  schemaVersion: number;
  current: string;
  versions: ChangelogEntry[];
}

export interface BuildInfo {
  sha: string;
  date: string;
  version: string;
  hasChangelog: boolean;
  changelog: ChangelogEntry | null;
}
