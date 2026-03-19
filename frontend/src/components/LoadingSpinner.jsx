const sizes = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

export default function LoadingSpinner({ size = "md", text }) {
  const spinnerSize = sizes[size] || sizes.md;

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6">
      <svg
        className={`${spinnerSize} animate-spin text-blue-600`}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>

      {text ? <p className="text-sm text-slate-600">{text}</p> : null}
    </div>
  );
}
