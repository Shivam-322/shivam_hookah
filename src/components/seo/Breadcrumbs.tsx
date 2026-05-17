import Link from "next/link";

interface BreadcrumbItem {
  name: string;
  href: string;
}

export function Breadcrumbs({
  items,
}: {
  items: BreadcrumbItem[];
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 text-sm text-gray-500 py-3"
    >
      {items.map((item, index) => (
        <div key={item.href} className="flex items-center gap-2">
          {index > 0 && <span className="text-gray-300">/</span>}
          {index === items.length - 1 ? (
            <span className="text-gray-800 font-medium">{item.name}</span>
          ) : (
            <Link
              href={item.href}
              className="hover:text-gray-800 transition-colors"
            >
              {item.name}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
