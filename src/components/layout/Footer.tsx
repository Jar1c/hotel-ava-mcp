import { Link } from "react-router"
import { footerLinkGroups } from "@/data/navigation"
import { MapPin, Phone, Globe } from "lucide-react"

export default function Footer() {
  return (
    <footer className="border-t border-hairline bg-canvas mt-xxl">
      {/* Link columns section */}
      <div className="max-w-container mx-auto w-full px-base py-section">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-lg">
          {/* Brand column */}
          <div>
            <h4 className="font-display text-ink text-lg font-semibold mb-md">Hotel Ava Malate</h4>
            <div className="space-y-sm mb-md">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
                <span className="typo-body-sm text-muted">2184 Carolina st, corner Quirino Ave, Malate, Manila</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-secondary shrink-0" />
                <span className="typo-body-sm text-muted">(02) 5310 3889</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-secondary shrink-0" />
                <span className="typo-body-sm text-muted">+63 926 006 8565</span>
              </div>
            </div>
            <div className="flex items-center gap-sm">
              <a href="https://facebook.com/hotelavaph" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-surface-soft flex items-center justify-center text-muted hover:bg-primary hover:text-on-primary transition-colors" aria-label="Facebook">
                <Globe className="h-4 w-4" />
              </a>
              <a href="https://instagram.com/hotelavaph" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-surface-soft flex items-center justify-center text-muted hover:bg-primary hover:text-on-primary transition-colors" aria-label="Instagram">
                <Globe className="h-4 w-4" />
              </a>
              <a href="https://twitter.com/hotelavaph" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-surface-soft flex items-center justify-center text-muted hover:bg-primary hover:text-on-primary transition-colors" aria-label="Twitter">
                <Globe className="h-4 w-4" />
              </a>
            </div>
          </div>

          {footerLinkGroups.map((group) => (
            <div key={group.title}>
              <h4 className="typo-title-sm text-ink mb-md">{group.title}</h4>
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

      {/* Legal band */}
      <div className="border-t border-hairline-soft">
        <div className="max-w-container mx-auto w-full px-base py-lg flex flex-col sm:flex-row items-center justify-between gap-sm">
          <p className="typo-caption-sm text-muted-soft">
            &copy; {new Date().getFullYear()} Hotel Ava. All rights reserved.
          </p>
          <div className="flex items-center gap-md">
            <Link to="/privacy" className="typo-caption-sm text-muted-soft hover:text-ink transition-colors">Privacy</Link>
            <Link to="/terms" className="typo-caption-sm text-muted-soft hover:text-ink transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}