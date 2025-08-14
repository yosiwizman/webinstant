import React from 'react';

interface WebsiteReadyEmailProps {
  businessName: string;
  previewUrl: string;
  previewImage: string;
  trackingPixelUrl?: string;
}

export const WebsiteReadyEmail: React.FC<WebsiteReadyEmailProps> = ({
  businessName,
  previewUrl,
  previewImage,
  trackingPixelUrl
}) => {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{businessName} - Your Website is Ready!</title>
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        backgroundColor: '#f4f4f5',
        color: '#18181b'
      }}>
        <table width="100%" cellPadding="0" cellSpacing="0" style={{ backgroundColor: '#f4f4f5' }}>
          <tr>
            <td align="center" style={{ padding: '40px 20px' }}>
              <table width="600" cellPadding="0" cellSpacing="0" style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
                overflow: 'hidden'
              }}>
                {/* Header */}
                <tr>
                  <td style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    padding: '40px 40px 30px',
                    textAlign: 'center'
                  }}>
                    <h1 style={{
                      margin: 0,
                      color: '#ffffff',
                      fontSize: '28px',
                      fontWeight: '700',
                      letterSpacing: '-0.5px'
                    }}>
                      🎉 Exciting News, {businessName}!
                    </h1>
                    <p style={{
                      margin: '12px 0 0',
                      color: '#e0e7ff',
                      fontSize: '18px',
                      fontWeight: '400'
                    }}>
                      Your professional website is ready to preview
                    </p>
                  </td>
                </tr>

                {/* Preview Image */}
                {previewImage && (
                  <tr>
                    <td style={{ padding: '0' }}>
                      <a href={previewUrl} style={{ display: 'block' }}>
                        <img 
                          src={previewImage} 
                          alt="Website Preview" 
                          style={{
                            width: '100%',
                            height: 'auto',
                            display: 'block',
                            borderTop: '1px solid #e5e7eb',
                            borderBottom: '1px solid #e5e7eb'
                          }}
                        />
                      </a>
                    </td>
                  </tr>
                )}

                {/* Content */}
                <tr>
                  <td style={{ padding: '40px' }}>
                    <h2 style={{
                      margin: '0 0 20px',
                      fontSize: '24px',
                      fontWeight: '600',
                      color: '#18181b',
                      textAlign: 'center'
                    }}>
                      Your Website is Ready to Launch! 🚀
                    </h2>

                    <p style={{
                      margin: '0 0 24px',
                      fontSize: '16px',
                      lineHeight: '24px',
                      color: '#52525b',
                      textAlign: 'center'
                    }}>
                      We've created a stunning, professional website for <strong>{businessName}</strong> that's ready to attract new customers and grow your business online.
                    </p>

                    <div style={{
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                      padding: '24px',
                      margin: '0 0 32px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <h3 style={{
                        margin: '0 0 16px',
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#18181b'
                      }}>
                        ✨ What's Included:
                      </h3>
                      <ul style={{
                        margin: 0,
                        padding: '0 0 0 20px',
                        color: '#52525b',
                        fontSize: '15px',
                        lineHeight: '24px'
                      }}>
                        <li style={{ marginBottom: '8px' }}>Professional design tailored to your business</li>
                        <li style={{ marginBottom: '8px' }}>Mobile-responsive layout that looks great on all devices</li>
                        <li style={{ marginBottom: '8px' }}>SEO-optimized content to help customers find you</li>
                        <li style={{ marginBottom: '8px' }}>Contact information and business hours</li>
                        <li style={{ marginBottom: '8px' }}>Ready to go live immediately</li>
                      </ul>
                    </div>

                    {/* CTA Button */}
                    <table width="100%" cellPadding="0" cellSpacing="0">
                      <tr>
                        <td align="center" style={{ padding: '0 0 24px' }}>
                          <a href={previewUrl} style={{
                            display: 'inline-block',
                            padding: '16px 48px',
                            backgroundColor: '#7c3aed',
                            color: '#ffffff',
                            fontSize: '18px',
                            fontWeight: '600',
                            textDecoration: 'none',
                            borderRadius: '8px',
                            boxShadow: '0 4px 14px 0 rgba(124, 58, 237, 0.35)',
                            transition: 'all 0.3s ease'
                          }}>
                            Claim Your Website - It's FREE to Preview!
                          </a>
                        </td>
                      </tr>
                    </table>

                    <div style={{
                      textAlign: 'center',
                      padding: '24px',
                      backgroundColor: '#fef3c7',
                      borderRadius: '8px',
                      border: '1px solid #fde68a',
                      margin: '0 0 24px'
                    }}>
                      <p style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#92400e'
                      }}>
                        🎁 Limited Time Offer
                      </p>
                      <p style={{
                        margin: '8px 0 0',
                        fontSize: '14px',
                        color: '#b45309'
                      }}>
                        Preview your website completely FREE. No credit card required!
                      </p>
                    </div>

                    <p style={{
                      margin: '0',
                      fontSize: '14px',
                      lineHeight: '20px',
                      color: '#71717a',
                      textAlign: 'center'
                    }}>
                      Have questions? Simply reply to this email and our team will be happy to help!
                    </p>
                  </td>
                </tr>

                {/* Footer */}
                <tr>
                  <td style={{
                    padding: '32px 40px',
                    backgroundColor: '#fafafa',
                    borderTop: '1px solid #e5e7eb'
                  }}>
                    <p style={{
                      margin: '0 0 8px',
                      fontSize: '13px',
                      color: '#71717a',
                      textAlign: 'center'
                    }}>
                      © 2024 Your Company. All rights reserved.
                    </p>
                    <p style={{
                      margin: 0,
                      fontSize: '12px',
                      color: '#a1a1aa',
                      textAlign: 'center'
                    }}>
                      You received this email because your business was selected for a free website preview.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        {/* Tracking Pixel */}
        {trackingPixelUrl && (
          <img 
            src={trackingPixelUrl} 
            alt="" 
            width="1" 
            height="1" 
            style={{ display: 'block', border: 'none' }}
          />
        )}
      </body>
    </html>
  );
};
