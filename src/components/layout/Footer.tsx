import { Link } from "react-router-dom"
import { footerLinkGroups } from "@/data/navigation"
import { Mail, Globe, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Footer() {
  return (
    <footer className="border-t border-hairline bg-canvas mt-xxl">
      {/* Newsletter section */}
      <div className="border-b border-hairline-soft">
        <div className="mx-auto w-full px-base py-lg flex flex-col sm:flex-row items-center justify-between gap-md" style={{ maxWidth: "var(--container-max)" }}>
          <div className="flex items-center gap-sm">
            <Mail className="h-5 w-5 text-secondary" />
            <span className="typo-title-md text-ink">Stay updated with Hotel Ava</span>
          </div>
          <div className="flex items-center gap-sm">
            <input
              type="email"
              placeholder="Enter your email"
              className="px-base py-sm rounded-sm border border-hairline bg-canvas typo-body-sm text-ink placeholder:text-muted-soft focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-64"
            />
            <Button variant="default" className="bg-primary text-on-primary hover:bg-primary-active">
              Subscribe
            </Button>
          </div>
        </div>
      </div>

      {/* Link columns section */}
      <div className="mx-auto w-full px-base py-section" style={{ maxWidth: "var(--container-max)" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-lg">
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
          <div>
            <h4 className="typo-title-sm text-ink mb-md">Discover</h4>
            <ul className="space-y-sm">
              <li><Link to="/rooms" className="typo-body-sm text-muted hover:text-ink transition-colors">Rooms & Suites</Link></li>
              <li><Link to="/about" className="typo-body-sm text-muted hover:text-ink transition-colors">Our Story</Link></li>
              <li><Link to="/help" className="typo-body-sm text-muted hover:text-ink transition-colors">Gift Cards</Link></li>
              <li><Link to="/help" className="typo-body-sm text-muted hover:text-ink transition-colors">Loyalty Program</Link></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Legal band */}
      <div className="border-t border-hairline-soft">
        <div className="mx-auto w-full px-base py-lg flex flex-col sm:flex-row items-center justify-between gap-sm" style={{ maxWidth: "var(--container-max)" }}>
          <p className="typo-caption-sm text-muted-soft">
            &copy; {new Date().getFullYear()} Hotel Ava. All rights reserved.
          </p>
          <div className="flex items-center gap-md">
            <Link to="/privacy" className="typo-caption-sm text-muted-soft hover:text-ink transition-colors">Privacy</Link>
            <Link to="/terms" className="typo-caption-sm text-muted-soft hover:text-ink transition-colors">Terms</Link>
            <Link to="/cookies" className="typo-caption-sm text-muted-soft hover:text-ink transition-colors">Cookies</Link>
            <span className="text-hairline">|</span>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-muted-soft hover:text-ink transition-colors">
              <Globe className="h-4 w-4" />
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-muted-soft hover:text-ink transition-colors">
              <ExternalLink className="h-4 w-4" />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-muted-soft hover:text-ink transition-colors">
              <Globe className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}