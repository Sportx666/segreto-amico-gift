/**
 * Skip link component for improved keyboard navigation accessibility
 */
export const SkipLink = ({ targetId = "main-content", children = "Salta al contenuto principale" }: {
  targetId?: string;
  children?: React.ReactNode;
}) => (
  <a
    href={`#${targetId}`}
    className="skip-link"
    tabIndex={0}
  >
    {children}
  </a>
);