import React from 'react';
import { Wordmark } from './ui/index.js';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  const mainLinks = [
    { label: 'FAQ', href: '/faq' },
    { label: 'About Us', href: '/about-us' },
    { label: 'Returns', href: '/return-refund-policy' },
    { label: 'Shipping', href: '/payment-shipping-cancellation-policy' },
    // { label: 'Contact', href: '/contact' },
    { label: 'Disclaimer', href: '/customization-disclaimer-policy' },
  ];

  const legalLinks = [
    { label: 'Terms & Conditions', href: '/terms-and-conditions' },
    { label: 'Privacy Policy', href: '/privacy-policy' },
    // { label: 'Legal Notice', href: '/legal' },
  ];

  return (
    <footer className="border-t border-mt-line bg-mt-surface-raised font-brand text-mt-text" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Wordmark */}
        <div className="mb-8 text-center">
          <Wordmark size="lg" />
          <p className="mt-3 text-sm text-mt-muted">Premium custom wear, designed by you.</p>
        </div>

        {/* Main navigation */}
        <nav aria-label="Footer navigation">
          <ul className="mb-10 flex flex-wrap justify-center gap-x-8 gap-y-3">
            {mainLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="inline-flex py-1.5 text-xs uppercase tracking-[0.18em] text-mt-muted transition-colors duration-200 hover:text-mt-text"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-mt-line pt-8">
          {/* Agency credit */}
          <div className="mb-3 text-center">
            <p className="text-xs tracking-wider text-mt-subtle">
              Site by{' '}
              <a
                href="https://maitrova.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-mt-muted transition-colors duration-200 hover:text-mt-text"
              >
                Maitrova
              </a>
            </p>
          </div>

          {/* Copyright */}
          <div className="mb-5 text-center">
            <p className="text-xs tracking-wider text-mt-subtle">
              © {currentYear} Maitrova. All rights reserved.
            </p>
          </div>

          {/* Legal links */}
          <nav aria-label="Legal information">
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs">
              {legalLinks.map((link, index) => (
                <React.Fragment key={link.label}>
                  <li>
                    <a
                      href={link.href}
                      className="inline-flex py-1 tracking-wide text-mt-subtle transition-colors duration-200 hover:text-mt-text"
                    >
                      {link.label}
                    </a>
                  </li>
                  {index < legalLinks.length - 1 && (
                    <li className="hidden text-mt-line-strong sm:block" aria-hidden="true">
                      |
                    </li>
                  )}
                </React.Fragment>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
