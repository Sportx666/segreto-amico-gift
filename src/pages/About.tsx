import { Link } from 'react-router-dom';
import { Gift, Users, Heart, ArrowRight, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useI18n } from '@/i18n';
import { useAuth } from '@/components/AuthProvider';
import { SEO } from '@/components/SEO';
import logo from '@/assets/logo.png';

const About = () => {
  const { t } = useI18n();
  const { user } = useAuth();


  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Chi Siamo - Amico Segreto',
    description: 'Organizza il tuo Secret Santa online gratis con Amico Segreto',
    url: 'https://amicosegreto.fun/chi-siamo',
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <div className="bg-gradient-hero text-white">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="mx-auto w-20 h-20 flex items-center justify-center">
              <img src={logo} alt="Amico Segreto" className="w-full h-full object-contain drop-shadow-2xl" />
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold">
              {t('about.hero_title')}
            </h1>
            <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto">
              {t('about.hero_subtitle')}
            </p>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-12">
        {/* What is it */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">{t('about.what_title')}</h2>
          <p className="text-muted-foreground text-lg leading-relaxed">{t('about.what_description')}</p>
        </div>

        {/* How it works */}
        <div className="mb-16">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">{t('about.how_title')}</h2>
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

        {/* FAQ */}
        <div className="max-w-3xl mx-auto mb-16">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
            <HelpCircle className="inline-block w-7 h-7 mr-2 align-text-bottom text-primary" />
            {t('about.faq_title')}
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {(['what_is_ss', 'is_free', 'how_wishlist', 'how_many', 'is_anonymous'] as const).map((key) => (
              <AccordionItem key={key} value={key}>
                <AccordionTrigger>{t(`about.faq.${key}.q`)}</AccordionTrigger>
                <AccordionContent>{t(`about.faq.${key}.a`)}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* CTA */}
        <div className="py-12 rounded-2xl bg-gradient-hero text-white text-center">
          <div className="max-w-2xl mx-auto px-4 space-y-6">
            <Gift className="w-16 h-16 mx-auto opacity-90" />
            <h2 className="text-3xl font-bold">{t('about.cta_title')}</h2>
            <p className="text-white/90 text-lg">{t('about.cta_description')}</p>
            <div className="flex flex-wrap gap-4 justify-center">
              {!user ? (
                <Link to="/auth">
                  <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                    {t('about.cta_button')}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              ) : (
                <Link to="/events">
                  <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                    {t('about.cta_button_logged_in')}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              )}
              <Link to="/regali">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                  {t('footer.gift_guide')}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default About;
