export type ArtifactType = "code" | "html" | "react" | "svg" | "markdown";

export type ParsedArtifact = {
  id: string;
  type: ArtifactType;
  title: string;
  language?: string;
  content: string;
};

export type ParsedContent = {
  text: string; // Text with artifacts replaced by placeholders
  artifacts: ParsedArtifact[];
};

const ARTIFACT_REGEX = /<artifact\s+type="([^"]+)"\s+title="([^"]+)"(?:\s+language="([^"]+)")?\s*>([\s\S]*?)<\/artifact>/g;

let artifactCounter = 0;

/**
 * Parse artifacts from Claude's response
 */
export function parseArtifacts(content: string): ParsedContent {
  const artifacts: ParsedArtifact[] = [];

  const text = content.replace(ARTIFACT_REGEX, (_, type, title, language, artifactContent) => {
    const id = `artifact-${Date.now()}-${++artifactCounter}`;
    artifacts.push({
      id,
      type: type as ArtifactType,
      title,
      language: language || undefined,
      content: artifactContent.trim(),
    });
    // Return a placeholder that can be rendered as a clickable reference
    return `[[ARTIFACT:${id}:${title}]]`;
  });

  return { text, artifacts };
}

/**
 * Check if content contains any artifacts
 */
export function hasArtifacts(content: string): boolean {
  return ARTIFACT_REGEX.test(content);
}

/**
 * Get file extension for artifact type/language
 */
export function getFileExtension(type: ArtifactType, language?: string): string {
  if (type === "html") return "html";
  if (type === "svg") return "svg";
  if (type === "markdown") return "md";
  if (type === "react") return language === "tsx" ? "tsx" : "jsx";
  if (type === "code" && language) {
    const extensions: Record<string, string> = {
      javascript: "js",
      typescript: "ts",
      python: "py",
      rust: "rs",
      go: "go",
      java: "java",
      cpp: "cpp",
      c: "c",
      ruby: "rb",
      php: "php",
      swift: "swift",
      kotlin: "kt",
      css: "css",
      scss: "scss",
      json: "json",
      yaml: "yaml",
      sql: "sql",
      shell: "sh",
      bash: "sh",
    };
    return extensions[language.toLowerCase()] || language.toLowerCase();
  }
  return "txt";
}
