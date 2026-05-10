import React from 'react';

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
    <footer className="bg-white border-t border-gray-200" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Main navigation */}
        <nav aria-label="Footer navigation">
          <ul className="flex flex-wrap justify-center gap-x-8 gap-y-4 mb-10">
            {mainLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-200 uppercase tracking-wide"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Agency credit */}
        <div className="text-center mb-6">
          <p className="text-xs text-gray-400 tracking-wider">
            Site by{' '}
            <a
              href="https://maitrova.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
            >
              Maitrova
            </a>
          </p>
        </div>

        {/* Copyright */}
        <div className="text-center mb-8">
          <p className="text-xs text-gray-400 tracking-wider">
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
                    className="text-gray-400 hover:text-gray-600 transition-colors duration-200 tracking-wide"
                  >
                    {link.label}
                  </a>
                </li>
                {index < legalLinks.length - 1 && (
                  <li className="hidden sm:block text-gray-300" aria-hidden="true">
                    |
                  </li>
                )}
              </React.Fragment>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
