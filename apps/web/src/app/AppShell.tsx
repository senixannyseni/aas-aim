import type { JSX, ReactNode } from "react";

/**
 * A same-page navigation target. The shell intentionally does not invent
 * application routes or represent unavailable modules as working links.
 */
export type AppShellNavigationItem = Readonly<{
  label: string;
  href: `#${string}`;
}>;

export type AppShellProps = Readonly<{
  children: ReactNode;
  navigation: readonly AppShellNavigationItem[];
}>;

/**
 * Presentation-only browser layout for Bandha AIM.
 *
 * Provides page landmarks, an accessible skip link, and navigation to real
 * sections rendered by its children. It does not own authentication,
 * authorization, engineering state, API calls, or routing.
 */
export function AppShell({ children, navigation }: AppShellProps): JSX.Element {
  return (
    <div className="aim-app">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="aim-header">
        <div className="aim-brand">
          <span className="aim-brand__mark" aria-hidden="true">
            A
          </span>
          <div>
            <p className="aim-product-name">Bandha AIM</p>
            <p className="aim-brand__subtitle">Integrity Assurance Management</p>
          </div>
        </div>
        <span className="aim-environment">Interface prototype</span>
      </header>

      <div className="aim-workspace-layout">
        <aside className="aim-sidebar">
          <nav aria-label="Workspace sections">
            <p className="aim-sidebar__heading">Workspace</p>
            <ul className="aim-sidebar__links">
              {navigation.map((item) => (
                <li key={item.href}>
                  <a className="aim-sidebar__link" href={item.href}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <p className="aim-sidebar__note">
            Navigation links only to sections available in this prototype.
          </p>
        </aside>

        <main id="main-content" className="aim-workspace-content" tabIndex={-1}>
          {children}
        </main>
      </div>

      <footer className="aim-footer">
        <small>
          Prototype interface only. Reported classifications are not equipment
          safety decisions or engineering approvals.
        </small>
      </footer>
    </div>
  );
}
