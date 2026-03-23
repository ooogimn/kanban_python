import { Helmet } from 'react-helmet-async';
import { getPublicSiteUrl, toAbsoluteUrl } from '../lib/seo';

interface SEOMetaProps {
    title: string;
    description: string;
    url?: string;
    image?: string;
    type?: 'website' | 'article';
    // If true, tells search engines not to index this page (e.g., account pages)
    noindex?: boolean;
}

const DEFAULT_IMAGE = '/og-image.jpg'; // We can replace this with a real default image later

/**
 * Reusable SEO Meta Component
 * Automatically injects standard <meta>, OpenGraph, and Twitter tags into the document <head>
 */
export function SEOMeta({
    title,
    description,
    url,
    image = DEFAULT_IMAGE,
    type = 'website',
    noindex = false,
}: SEOMetaProps) {
    // Add a suffix to the title
    const fullTitle = `${title} | AntExpress`;
    const siteUrl = getPublicSiteUrl();
    const fullUrl = url ? toAbsoluteUrl(url) : siteUrl;
    // Ensure image URL is absolute
    const fullImage = toAbsoluteUrl(image || DEFAULT_IMAGE);

    return (
        <Helmet>
            {/* Standard Meta Tags */}
            <title>{fullTitle}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={fullUrl} />
            <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />

            {/* OpenGraph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={fullUrl} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={fullImage} />
            <meta property="og:site_name" content="AntExpress" />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={fullUrl} />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={fullImage} />
        </Helmet>
    );
}
