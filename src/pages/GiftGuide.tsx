import { Link } from 'react-router-dom';
import { Gift, Sparkles, Users, Heart, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/i18n';
import { useAuth } from '@/components/AuthProvider';
import { curatedCategories } from '@/data/curatedGifts';
import { GiftCategorySection } from '@/components/gifts/GiftCategorySection';
import { AffiliateDisclosure } from '@/components/gifts/AffiliateDisclosure';
import logo from '@/assets/logo.png';

const GiftGuide = () => {
  const { t } = useI18n();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
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
            <AffiliateDisclosure className="mx-auto" />
          </div>
        </div>
      </div>

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
        {/* Editorial Intro */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            {t('gift_guide.intro_title')}
          </h2>
          <p className="text-muted-foreground text-lg">
            {t('gift_guide.intro_description')}
          </p>
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

      {/* Affiliate Footer Disclosure */}
      <AffiliateDisclosure variant="footer" />
    </div>
  );
};

export default GiftGuide;
