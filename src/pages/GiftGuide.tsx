import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Gift, Sparkles, Users, Heart, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/i18n';
import { useAuth } from '@/components/AuthProvider';
import { curatedCategories } from '@/data/curatedGifts';
import { GiftCategorySection } from '@/components/gifts/GiftCategorySection';
import { AffiliateDisclosure } from '@/components/gifts/AffiliateDisclosure';
import { amazonSearchUrl, ideaBucketUrl } from '@/lib/amazon';
import logo from '@/assets/logo.png';

const GiftGuide = () => {
  const { t } = useI18n();
  const { user } = useAuth();

  // Open Graph meta tags
  useEffect(() => {
    const metas: HTMLMetaElement[] = [];
    const set = (property: string, content: string) => {
      const el = document.createElement('meta');
      el.setAttribute('property', property);
      el.content = content;
      document.head.appendChild(el);
      metas.push(el);
    };
    set('og:title', 'Guida ai Regali - Amico Segreto');
    set('og:description', 'Idee regalo curate per ogni budget e occasione');
    set('og:url', 'https://amicosegreto.fun/regali');
    set('og:type', 'website');
    set('og:image', 'https://amicosegreto.fun/icons/icon-512x512.png');
    return () => metas.forEach(m => m.remove());
  }, []);

  // Schema.org JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Guida ai Regali - Amico Segreto',
    description: 'Idee regalo curate per ogni budget e occasione',
    url: 'https://amicosegreto.fun/regali',
    numberOfItems: curatedCategories.length,
    itemListElement: curatedCategories.map((cat, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t(cat.titleKey),
      url: cat.maxPrice
        ? ideaBucketUrl(cat.maxPrice, cat.searchQuery)
        : amazonSearchUrl(cat.searchQuery),
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Hero Section */}
      <div className="bg-gradient-hero text-white">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="mx-auto w-20 h-20 flex items-center justify-center">
              <img src={logo} alt="Amico Segreto" className="w-full h-full object-contain drop-shadow-2xl" />
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold">
              {t('gift_guide.hero_title')}
            </h1>
            <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto">
              {t('gift_guide.hero_subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Prominent affiliate disclosure — must remain above-the-fold for Amazon Associates compliance */}
      <AffiliateDisclosure variant="prominent" />

      {/* Quick Category Navigation */}
      <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {curatedCategories.map((cat) => (
              <a
                key={cat.id}
                href={`#${cat.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors whitespace-nowrap text-sm font-medium"
              >
                <span>{cat.icon}</span>
                <span>{t(cat.titleKey)}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Editorial intro — original Italian content above the product grid */}
        <div className="max-w-3xl mx-auto mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">
            {t('gift_guide.intro_title')}
          </h2>
          <div
            className="prose prose-neutral dark:prose-invert max-w-none text-muted-foreground prose-p:leading-relaxed prose-p:mb-4"
            dangerouslySetInnerHTML={{ __html: t('gift_guide.intro_body_html') }}
          />
        </div>

        {/* Gift Categories */}
        <div className="space-y-12">
          {curatedCategories.map((category) => (
            <GiftCategorySection key={category.id} category={category} />
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-16 py-12 rounded-2xl bg-gradient-hero text-white text-center">
          <div className="max-w-2xl mx-auto px-4 space-y-6">
            <Gift className="w-16 h-16 mx-auto opacity-90" />
            <h2 className="text-3xl font-bold">
              {t('gift_guide.cta_title')}
            </h2>
            <p className="text-white/90 text-lg">
              {t('gift_guide.cta_description')}
            </p>
            {!user ? (
              <Link to="/auth">
                <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                  {t('gift_guide.cta_button')}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            ) : (
              <Link to="/events">
                <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                  {t('gift_guide.cta_button_logged_in')}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* How It Works Section */}
        <div className="mt-16">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
            {t('gift_guide.how_it_works_title')}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>{t('home.create_event_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{t('home.create_event_desc')}</CardDescription>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                  <Gift className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>{t('home.draw_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{t('home.draw_desc')}</CardDescription>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                  <Heart className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>{t('home.wishlist_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{t('home.wishlist_desc')}</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

    
    </div>
  );
};

export default GiftGuide;
