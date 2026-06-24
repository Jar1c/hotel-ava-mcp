import { Link } from "react-router-dom"
import { footerLinkGroups } from "@/data/navigation"

export default function Footer() {
  return (
    <footer className="border-t border-hairline bg-canvas mt-xxl">
      <div className="mx-auto w-full px-base py-section" style={{ maxWidth: "var(--container-max)" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-lg">
          {footerLinkGroups.map((group) => (
            <div key={group.title}>
              <h4 className="typo-title-md text-ink mb-md">{group.title}</h4>
              <ul className="space-y-sm">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.path} className="typo-body-sm text-muted hover:text-ink transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-hairline-soft">
        <div className="mx-auto w-full px-base py-lg flex flex-col sm:flex-row items-center justify-between gap-sm" style={{ maxWidth: "var(--container-max)" }}>
          <p className="typo-caption-sm text-muted-soft">
            &copy; {new Date().getFullYear()} Hotel Ava. All rights reserved.
          </p>
          <div className="flex items-center gap-md">
            <Link to="/privacy" className="typo-caption-sm text-muted-soft hover:text-ink transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="typo-caption-sm text-muted-soft hover:text-ink transition-colors">
              Terms
            </Link>
            <Link to="/cookies" className="typo-caption-sm text-muted-soft hover:text-ink transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}