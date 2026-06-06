type ArticleLinkProps = {
  title: string | null;
  doi?: string | null;
  journal?: string | null;
  variant?: "light" | "dark";
  className?: string;
};

export default function ArticleLink({
  title,
  doi,
  journal,
  variant = "light",
  className = "",
}: ArticleLinkProps) {
  if (!title && !doi) return null;

  const linkClass =
    variant === "dark" ? "text-blue-400 hover:underline" : "text-blue-600 hover:underline";
  const textClass = variant === "dark" ? "text-stone-400" : "text-stone-500";
  const label = title ?? "Untitled";

  return (
    <p className={`text-xs ${textClass} ${className}`}>
      <span className="font-medium">Source: </span>
      {doi ? (
        <a
          href={`https://doi.org/${doi}`}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          {label}
        </a>
      ) : (
        <span className={variant === "dark" ? "text-stone-300" : "text-stone-700"}>
          {label}
        </span>
      )}
      {journal && <span className="ml-1 text-stone-400">· {journal}</span>}
    </p>
  );
}
