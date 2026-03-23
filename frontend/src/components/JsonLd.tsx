import { Helmet } from 'react-helmet-async';

interface JsonLdProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>;
}

export function JsonLd({ data }: JsonLdProps) {
    return (
        <Helmet>
            <script type="application/ld+json">
                {JSON.stringify(data)}
            </script>
        </Helmet>
    );
}
