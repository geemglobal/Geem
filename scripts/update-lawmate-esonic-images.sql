-- Lawmate + Esonic image update for production DB
-- Run: psql $DATABASE_URL -f scripts/update-lawmate-esonic-images.sql
BEGIN;

UPDATE products SET
  featured_image = '/products/esonic/br20/img_1.jpg',
  gallery_images = '["/products/esonic/br20/img_1.jpg","/products/esonic/br20/img_2.jpg","/products/esonic/br20/img_3.jpg","/products/esonic/br20/img_4.jpg"]'
  WHERE slug = 'esonic-br20';

UPDATE products SET
  featured_image = '/products/esonic/kc500/img_1.jpg',
  gallery_images = '["/products/esonic/kc500/img_1.jpg","/products/esonic/kc500/img_2.jpg","/products/esonic/kc500/img_3.jpg","/products/esonic/kc500/img_4.jpg","/products/esonic/kc500/img_5.jpg"]'
  WHERE slug = 'esonic-kc-500';

UPDATE products SET
  featured_image = '/products/esonic/mql500n/img_1.jpg',
  gallery_images = '["/products/esonic/mql500n/img_1.jpg","/products/esonic/mql500n/img_2.jpg","/products/esonic/mql500n/img_3.jpg","/products/esonic/mql500n/img_4.jpg","/products/esonic/mql500n/img_5.jpg"]'
  WHERE slug = 'esonic-memoq-mq-l500n';

UPDATE products SET
  featured_image = '/products/esonic/mqu350/img_1.jpg',
  gallery_images = '["/products/esonic/mqu350/img_1.jpg","/products/esonic/mqu350/img_2.jpg"]'
  WHERE slug = 'esonic-memoq-mq-u350';

UPDATE products SET
  featured_image = '/products/esonic/mq79/img_1.jpg',
  gallery_images = '["/products/esonic/mq79/img_1.jpg","/products/esonic/mq79/img_2.jpg","/products/esonic/mq79/img_3.jpg"]'
  WHERE slug = 'esonic-mq-79';

UPDATE products SET
  featured_image = '/products/esonic/mq99/img_1.jpg',
  gallery_images = '["/products/esonic/mq99/img_1.jpg","/products/esonic/mq99/img_2.jpg","/products/esonic/mq99/img_3.jpg","/products/esonic/mq99/img_4.jpg","/products/esonic/mq99/img_5.jpg"]'
  WHERE slug = 'esonic-mq-99';

UPDATE products SET
  featured_image = '/products/esonic/mqu310/img_1.jpg',
  gallery_images = '["/products/esonic/mqu310/img_1.jpg","/products/esonic/mqu310/img_2.jpg","/products/esonic/mqu310/img_3.jpg","/products/esonic/mqu310/img_4.jpg","/products/esonic/mqu310/img_5.jpg"]'
  WHERE slug = 'esonic-mq-u310';

UPDATE products SET
  featured_image = '/products/esonic/mr130/img_1.jpg',
  gallery_images = '["/products/esonic/mr130/img_1.jpg","/products/esonic/mr130/img_2.jpg","/products/esonic/mr130/img_3.jpg","/products/esonic/mr130/img_4.jpg","/products/esonic/mr130/img_5.jpg"]'
  WHERE slug = 'esonic-mr-130';

UPDATE products SET
  featured_image = '/products/esonic/mr140/img_1.jpg',
  gallery_images = '["/products/esonic/mr140/img_1.jpg","/products/esonic/mr140/img_2.jpg","/products/esonic/mr140/img_3.jpg","/products/esonic/mr140/img_4.jpg","/products/esonic/mr140/img_5.jpg"]'
  WHERE slug = 'esonic-mr-140';

UPDATE products SET
  featured_image = '/products/esonic/mr150/img_1.jpg',
  gallery_images = '["/products/esonic/mr150/img_1.jpg","/products/esonic/mr150/img_2.jpg","/products/esonic/mr150/img_3.jpg","/products/esonic/mr150/img_4.jpg","/products/esonic/mr150/img_5.jpg"]'
  WHERE slug = 'esonic-mr-150';

UPDATE products SET
  featured_image = '/products/esonic/pcm008/img_1.jpg',
  gallery_images = '["/products/esonic/pcm008/img_1.jpg","/products/esonic/pcm008/img_2.jpg","/products/esonic/pcm008/img_3.jpg","/products/esonic/pcm008/img_4.jpg","/products/esonic/pcm008/img_5.jpg"]'
  WHERE slug = 'esonic-pcm-008';

UPDATE products SET
  featured_image = '/products/lawmate/ar100/img_1.jpg',
  gallery_images = '["/products/lawmate/ar100/img_1.jpg","/products/lawmate/ar100/img_2.jpg","/products/lawmate/ar100/img_3.jpg","/products/lawmate/ar100/img_4.jpg","/products/lawmate/ar100/img_5.jpg"]'
  WHERE slug = 'lawmate-ar-100';

UPDATE products SET
  featured_image = '/products/lawmate/ar300/img_1.jpg',
  gallery_images = '["/products/lawmate/ar300/img_1.jpg","/products/lawmate/ar300/img_2.jpg","/products/lawmate/ar300/img_3.jpg","/products/lawmate/ar300/img_4.jpg","/products/lawmate/ar300/img_5.jpg"]'
  WHERE slug = 'lawmate-ar-300';

UPDATE products SET
  featured_image = '/products/lawmate/bu18neo/img_1.jpg',
  gallery_images = '["/products/lawmate/bu18neo/img_1.jpg","/products/lawmate/bu18neo/img_2.jpg","/products/lawmate/bu18neo/img_3.jpg","/products/lawmate/bu18neo/img_4.jpg","/products/lawmate/bu18neo/img_5.jpg"]'
  WHERE slug = 'lawmate-bu-18neo';

UPDATE products SET
  featured_image = '/products/lawmate/bu19/img_1.jpg',
  gallery_images = '["/products/lawmate/bu19/img_1.jpg","/products/lawmate/bu19/img_2.jpg","/products/lawmate/bu19/img_3.jpg","/products/lawmate/bu19/img_4.jpg","/products/lawmate/bu19/img_5.jpg"]'
  WHERE slug = 'lawmate-bu-19';

UPDATE products SET
  featured_image = '/products/lawmate/cmbu20/img_1.jpg',
  gallery_images = '["/products/lawmate/cmbu20/img_1.jpg","/products/lawmate/cmbu20/img_2.jpg","/products/lawmate/cmbu20/img_3.jpg","/products/lawmate/cmbu20/img_4.jpg","/products/lawmate/cmbu20/img_5.jpg"]'
  WHERE slug = 'lawmate-cm-bu20';

UPDATE products SET
  featured_image = '/products/lawmate/cmtc10/img_1.jpg',
  gallery_images = '["/products/lawmate/cmtc10/img_1.jpg","/products/lawmate/cmtc10/img_2.jpg","/products/lawmate/cmtc10/img_3.jpg","/products/lawmate/cmtc10/img_4.jpg","/products/lawmate/cmtc10/img_5.jpg"]'
  WHERE slug = 'lawmate-cm-tc10';

UPDATE products SET
  featured_image = '/products/lawmate/cmdbu20lx/img_1.jpg',
  gallery_images = '["/products/lawmate/cmdbu20lx/img_1.jpg","/products/lawmate/cmdbu20lx/img_2.jpg","/products/lawmate/cmdbu20lx/img_3.jpg","/products/lawmate/cmdbu20lx/img_4.jpg","/products/lawmate/cmdbu20lx/img_5.jpg"]'
  WHERE slug = 'lawmate-cmd-bu20lx';

UPDATE products SET
  featured_image = '/products/lawmate/er18hd/img_1.jpg',
  gallery_images = '["/products/lawmate/er18hd/img_1.jpg","/products/lawmate/er18hd/img_2.jpg","/products/lawmate/er18hd/img_3.jpg","/products/lawmate/er18hd/img_4.jpg","/products/lawmate/er18hd/img_5.jpg"]'
  WHERE slug = 'lawmate-er-18hd';

UPDATE products SET
  featured_image = '/products/lawmate/nt18hd/img_1.jpg',
  gallery_images = '["/products/lawmate/nt18hd/img_1.jpg","/products/lawmate/nt18hd/img_2.jpg","/products/lawmate/nt18hd/img_3.jpg","/products/lawmate/nt18hd/img_4.jpg","/products/lawmate/nt18hd/img_5.jpg"]'
  WHERE slug = 'lawmate-nt-18hd';

UPDATE products SET
  featured_image = '/products/lawmate/pv1000ahd/img_1.jpg',
  gallery_images = '["/products/lawmate/pv1000ahd/img_1.jpg","/products/lawmate/pv1000ahd/img_2.jpg","/products/lawmate/pv1000ahd/img_3.jpg","/products/lawmate/pv1000ahd/img_4.jpg","/products/lawmate/pv1000ahd/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-1000ahd';

UPDATE products SET
  featured_image = '/products/lawmate/pv1000evo3/img_1.jpg',
  gallery_images = '["/products/lawmate/pv1000evo3/img_1.jpg","/products/lawmate/pv1000evo3/img_2.jpg","/products/lawmate/pv1000evo3/img_3.jpg","/products/lawmate/pv1000evo3/img_4.jpg","/products/lawmate/pv1000evo3/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-1000evo3';

UPDATE products SET
  featured_image = '/products/lawmate/pv500l4i/img_1.jpg',
  gallery_images = '["/products/lawmate/pv500l4i/img_1.jpg","/products/lawmate/pv500l4i/img_2.jpg","/products/lawmate/pv500l4i/img_3.jpg","/products/lawmate/pv500l4i/img_4.jpg"]'
  WHERE slug = 'lawmate-pv-500-l4i';

UPDATE products SET
  featured_image = '/products/lawmate/pv500lite3/img_1.jpg',
  gallery_images = '["/products/lawmate/pv500lite3/img_1.jpg","/products/lawmate/pv500lite3/img_2.jpg","/products/lawmate/pv500lite3/img_3.jpg","/products/lawmate/pv500lite3/img_4.jpg","/products/lawmate/pv500lite3/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-500-lite-3';

UPDATE products SET
  featured_image = '/products/lawmate/pv500eco2/img_1.jpg',
  gallery_images = '["/products/lawmate/pv500eco2/img_1.jpg","/products/lawmate/pv500eco2/img_2.jpg","/products/lawmate/pv500eco2/img_3.jpg","/products/lawmate/pv500eco2/img_4.jpg","/products/lawmate/pv500eco2/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-500eco2';

UPDATE products SET
  featured_image = '/products/lawmate/pv500neopro/img_1.jpg',
  gallery_images = '["/products/lawmate/pv500neopro/img_1.jpg","/products/lawmate/pv500neopro/img_2.jpg","/products/lawmate/pv500neopro/img_3.jpg","/products/lawmate/pv500neopro/img_4.jpg","/products/lawmate/pv500neopro/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-500neo-pro';

UPDATE products SET
  featured_image = '/products/lawmate/pv900evo3/img_1.jpg',
  gallery_images = '["/products/lawmate/pv900evo3/img_1.jpg","/products/lawmate/pv900evo3/img_2.jpg","/products/lawmate/pv900evo3/img_3.jpg","/products/lawmate/pv900evo3/img_4.jpg","/products/lawmate/pv900evo3/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-900evo3';

UPDATE products SET
  featured_image = '/products/lawmate/pvap10i/img_1.jpg',
  gallery_images = '["/products/lawmate/pvap10i/img_1.jpg","/products/lawmate/pvap10i/img_2.jpg","/products/lawmate/pvap10i/img_3.jpg","/products/lawmate/pvap10i/img_4.jpg"]'
  WHERE slug = 'lawmate-pv-ap10i';

UPDATE products SET
  featured_image = '/products/lawmate/pvbt10i/img_1.jpg',
  gallery_images = '["/products/lawmate/pvbt10i/img_1.jpg","/products/lawmate/pvbt10i/img_2.jpg","/products/lawmate/pvbt10i/img_3.jpg","/products/lawmate/pvbt10i/img_4.jpg","/products/lawmate/pvbt10i/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-bt10i';

UPDATE products SET
  featured_image = '/products/lawmate/pvcc10w/img_1.jpg',
  gallery_images = '["/products/lawmate/pvcc10w/img_1.jpg","/products/lawmate/pvcc10w/img_2.jpg","/products/lawmate/pvcc10w/img_3.jpg"]'
  WHERE slug = 'lawmate-pv-cc10w';

UPDATE products SET
  featured_image = '/products/lawmate/pvchg30i/img_1.jpg',
  gallery_images = '["/products/lawmate/pvchg30i/img_1.jpg","/products/lawmate/pvchg30i/img_2.jpg","/products/lawmate/pvchg30i/img_3.jpg","/products/lawmate/pvchg30i/img_4.jpg"]'
  WHERE slug = 'lawmate-pv-chg30i';

UPDATE products SET
  featured_image = '/products/lawmate/pvdy10i/img_1.jpg',
  gallery_images = '["/products/lawmate/pvdy10i/img_1.jpg","/products/lawmate/pvdy10i/img_2.jpg","/products/lawmate/pvdy10i/img_3.jpg","/products/lawmate/pvdy10i/img_4.jpg","/products/lawmate/pvdy10i/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-dy10i';

UPDATE products SET
  featured_image = '/products/lawmate/pvdy20i/img_1.jpg',
  gallery_images = '["/products/lawmate/pvdy20i/img_1.jpg","/products/lawmate/pvdy20i/img_2.jpg","/products/lawmate/pvdy20i/img_3.jpg","/products/lawmate/pvdy20i/img_4.jpg","/products/lawmate/pvdy20i/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-dy20i';

UPDATE products SET
  featured_image = '/products/lawmate/pvdy40uw/img_1.jpg',
  gallery_images = '["/products/lawmate/pvdy40uw/img_1.jpg","/products/lawmate/pvdy40uw/img_2.jpg","/products/lawmate/pvdy40uw/img_3.jpg","/products/lawmate/pvdy40uw/img_4.jpg","/products/lawmate/pvdy40uw/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-dy40uw';

UPDATE products SET
  featured_image = '/products/lawmate/pvdy40uww/img_1.jpg',
  gallery_images = '["/products/lawmate/pvdy40uww/img_1.jpg","/products/lawmate/pvdy40uww/img_2.jpg","/products/lawmate/pvdy40uww/img_3.jpg","/products/lawmate/pvdy40uww/img_4.jpg","/products/lawmate/pvdy40uww/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-dy40uww';

UPDATE products SET
  featured_image = '/products/lawmate/pveg10cl/img_1.jpg',
  gallery_images = '["/products/lawmate/pveg10cl/img_1.jpg","/products/lawmate/pveg10cl/img_2.jpg"]'
  WHERE slug = 'lawmate-pv-eg10cl';

UPDATE products SET
  featured_image = '/products/lawmate/pvfm20hdwi/img_1.jpg',
  gallery_images = '["/products/lawmate/pvfm20hdwi/img_1.jpg","/products/lawmate/pvfm20hdwi/img_2.jpg","/products/lawmate/pvfm20hdwi/img_3.jpg","/products/lawmate/pvfm20hdwi/img_4.jpg","/products/lawmate/pvfm20hdwi/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-fm20hdwi';

UPDATE products SET
  featured_image = '/products/lawmate/pvnb10w/img_1.jpg',
  gallery_images = '["/products/lawmate/pvnb10w/img_1.jpg","/products/lawmate/pvnb10w/img_2.jpg","/products/lawmate/pvnb10w/img_3.jpg"]'
  WHERE slug = 'lawmate-pv-nb10w';

UPDATE products SET
  featured_image = '/products/lawmate/pvpb20i/img_1.jpg',
  gallery_images = '["/products/lawmate/pvpb20i/img_1.jpg","/products/lawmate/pvpb20i/img_2.jpg","/products/lawmate/pvpb20i/img_3.jpg","/products/lawmate/pvpb20i/img_4.jpg","/products/lawmate/pvpb20i/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-pb20i';

UPDATE products SET
  featured_image = '/products/lawmate/pvpb30w/img_1.jpg',
  gallery_images = '["/products/lawmate/pvpb30w/img_1.jpg","/products/lawmate/pvpb30w/img_2.jpg","/products/lawmate/pvpb30w/img_3.jpg","/products/lawmate/pvpb30w/img_4.jpg","/products/lawmate/pvpb30w/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-pb30w';

UPDATE products SET
  featured_image = '/products/lawmate/pvrc10fhd/img_1.jpg',
  gallery_images = '["/products/lawmate/pvrc10fhd/img_1.jpg","/products/lawmate/pvrc10fhd/img_2.jpg","/products/lawmate/pvrc10fhd/img_3.jpg","/products/lawmate/pvrc10fhd/img_4.jpg","/products/lawmate/pvrc10fhd/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-rc10fhd';

UPDATE products SET
  featured_image = '/products/lawmate/pvrc200hd2/img_1.jpg',
  gallery_images = '["/products/lawmate/pvrc200hd2/img_1.jpg","/products/lawmate/pvrc200hd2/img_2.jpg","/products/lawmate/pvrc200hd2/img_3.jpg","/products/lawmate/pvrc200hd2/img_4.jpg","/products/lawmate/pvrc200hd2/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-rc200hd2';

UPDATE products SET
  featured_image = '/products/lawmate/pvrc200hdw/img_1.jpg',
  gallery_images = '["/products/lawmate/pvrc200hdw/img_1.jpg","/products/lawmate/pvrc200hdw/img_2.jpg","/products/lawmate/pvrc200hdw/img_3.jpg","/products/lawmate/pvrc200hdw/img_4.jpg","/products/lawmate/pvrc200hdw/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-rc200hdw';

UPDATE products SET
  featured_image = '/products/lawmate/pvrc400uw/img_1.jpg',
  gallery_images = '["/products/lawmate/pvrc400uw/img_1.jpg","/products/lawmate/pvrc400uw/img_2.jpg","/products/lawmate/pvrc400uw/img_3.jpg","/products/lawmate/pvrc400uw/img_4.jpg","/products/lawmate/pvrc400uw/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-rc400uw';

UPDATE products SET
  featured_image = '/products/lawmate/pvtc10i/img_1.jpg',
  gallery_images = '["/products/lawmate/pvtc10i/img_1.jpg","/products/lawmate/pvtc10i/img_2.jpg","/products/lawmate/pvtc10i/img_3.jpg","/products/lawmate/pvtc10i/img_4.jpg","/products/lawmate/pvtc10i/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-tc10i';

UPDATE products SET
  featured_image = '/products/lawmate/pvwb10i/img_1.jpg',
  gallery_images = '["/products/lawmate/pvwb10i/img_1.jpg","/products/lawmate/pvwb10i/img_2.jpg","/products/lawmate/pvwb10i/img_3.jpg","/products/lawmate/pvwb10i/img_4.jpg","/products/lawmate/pvwb10i/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-wb10i';

UPDATE products SET
  featured_image = '/products/lawmate/pvwt20w/img_1.jpg',
  gallery_images = '["/products/lawmate/pvwt20w/img_1.jpg","/products/lawmate/pvwt20w/img_2.jpg","/products/lawmate/pvwt20w/img_3.jpg"]'
  WHERE slug = 'lawmate-pv-wt20w';

UPDATE products SET
  featured_image = '/products/lawmate/rd10/img_1.jpg',
  gallery_images = '["/products/lawmate/rd10/img_1.jpg","/products/lawmate/rd10/img_2.jpg","/products/lawmate/rd10/img_3.jpg","/products/lawmate/rd10/img_4.jpg","/products/lawmate/rd10/img_5.jpg"]'
  WHERE slug = 'lawmate-rd-10';

UPDATE products SET
  featured_image = '/products/lawmate/rd30/img_1.jpg',
  gallery_images = '["/products/lawmate/rd30/img_1.jpg","/products/lawmate/rd30/img_2.jpg","/products/lawmate/rd30/img_3.jpg","/products/lawmate/rd30/img_4.jpg","/products/lawmate/rd30/img_5.jpg"]'
  WHERE slug = 'lawmate-rd-30';

COMMIT;
-- End: 49 products
