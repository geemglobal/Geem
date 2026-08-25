-- Comprehensive Geem product image fix
-- Auto-generated from filesystem scan + additional downloaded images
-- Run on VPS: psql $DATABASE_URL -f scripts/fix-all-catalog-images.sql
BEGIN;

UPDATE products SET
  featured_image = '/products/security/ajaxhub2/img_1.jpg',
  gallery_images = '["/products/security/ajaxhub2/img_1.jpg","/products/security/ajaxhub2/img_2.jpg","/products/security/ajaxhub2/img_3.jpg","/products/security/ajaxhub2/img_4.jpg","/products/security/ajaxhub2/img_5.jpg"]'
  WHERE slug = 'ajax-hub2-wireless-smart-alarm-starter-kit';

UPDATE products SET
  featured_image = '/products/security/biometric/img_1.png',
  gallery_images = '["/products/security/biometric/img_1.png","/products/security/biometric/img_2.jpg","/products/security/biometric/img_3.jpg","/products/security/biometric/img_4.jpg","/products/security/biometric/img_5.jpg"]'
  WHERE slug = 'biometric-fingerprint-access-controller-rfid';

UPDATE products SET
  featured_image = '/products/security/emlock/img_1.jpg',
  gallery_images = '["/products/security/emlock/img_1.jpg","/products/security/emlock/img_2.jpg","/products/security/emlock/img_3.jpg","/products/security/emlock/img_4.jpg","/products/security/emlock/img_5.jpg"]'
  WHERE slug = 'electromagnetic-door-lock-600lbs';

UPDATE products SET
  featured_image = '/products/security/hikvintercom/img_1.jpg',
  gallery_images = '["/products/security/hikvintercom/img_1.jpg","/products/security/hikvintercom/img_2.jpg","/products/security/hikvintercom/img_3.jpg","/products/security/hikvintercom/img_4.jpg","/products/security/hikvintercom/img_5.jpg"]'
  WHERE slug = 'hikvision-video-door-intercom-ds-kv8113';

UPDATE products SET
  featured_image = '/products/security/paradoxsp65/img_1.jpg',
  gallery_images = '["/products/security/paradoxsp65/img_1.jpg","/products/security/paradoxsp65/img_2.jpg","/products/security/paradoxsp65/img_3.png","/products/security/paradoxsp65/img_4.png","/products/security/paradoxsp65/img_5.png"]'
  WHERE slug = 'paradox-sp65-alarm-panel-8-zone';

UPDATE products SET
  featured_image = '/products/smart-security/dahuanvr/img_1.jpg',
  gallery_images = '["/products/smart-security/dahuanvr/img_1.jpg","/products/smart-security/dahuanvr/img_2.jpg","/products/smart-security/dahuanvr/img_3.jpg","/products/smart-security/dahuanvr/img_4.jpg","/products/smart-security/dahuanvr/img_5.jpg"]'
  WHERE slug = 'dahua-nvr4108hs-8p-4ks3-8ch-poe-nvr';

UPDATE products SET
  featured_image = '/products/smart-security/hikvcolorvu/img_1.png',
  gallery_images = '["/products/smart-security/hikvcolorvu/img_1.png","/products/smart-security/hikvcolorvu/img_2.png","/products/smart-security/hikvcolorvu/img_3.jpg","/products/smart-security/hikvcolorvu/img_4.jpg","/products/smart-security/hikvcolorvu/img_5.jpg"]'
  WHERE slug = 'hikvision-ds-2cd2t47g2-l-4mp-colorvu';

UPDATE products SET
  featured_image = '/products/smart-security/hikvnvr16/img_1.jpg',
  gallery_images = '["/products/smart-security/hikvnvr16/img_1.jpg","/products/smart-security/hikvnvr16/img_2.jpg","/products/smart-security/hikvnvr16/img_3.jpg","/products/smart-security/hikvnvr16/img_4.jpg","/products/smart-security/hikvnvr16/img_5.jpg"]'
  WHERE slug = 'hikvision-ds-7616ni-m2-16ch-4k-nvr';

UPDATE products SET
  featured_image = '/products/smart-security/reolink810a/img_1.jpg',
  gallery_images = '["/products/smart-security/reolink810a/img_1.jpg","/products/smart-security/reolink810a/img_2.jpg","/products/smart-security/reolink810a/img_3.jpg","/products/smart-security/reolink810a/img_4.jpg","/products/smart-security/reolink810a/img_5.jpg"]'
  WHERE slug = 'reolink-rlc-810a-8mp-smart-ip-camera';

UPDATE products SET
  featured_image = '/products/smart-security/smartlock/img_1.jpg',
  gallery_images = '["/products/smart-security/smartlock/img_1.jpg","/products/smart-security/smartlock/img_2.jpg","/products/smart-security/smartlock/img_3.jpg","/products/smart-security/smartlock/img_4.jpg","/products/smart-security/smartlock/img_5.jpg"]'
  WHERE slug = 'smart-fingerprint-door-lock-biometric-app';

UPDATE products SET
  featured_image = '/products/counter-surv/lensfinder/img_1.jpg',
  gallery_images = '["/products/counter-surv/lensfinder/img_1.jpg","/products/counter-surv/lensfinder/img_2.jpg","/products/counter-surv/lensfinder/img_3.png","/products/counter-surv/lensfinder/img_4.png","/products/counter-surv/lensfinder/img_5.jpg"]'
  WHERE slug = 'camera-lens-finder-pinhole-detector';

UPDATE products SET
  featured_image = '/products/counter-surv/gsmdetector/img_1.jpg',
  gallery_images = '["/products/counter-surv/gsmdetector/img_1.jpg","/products/counter-surv/gsmdetector/img_2.jpg","/products/counter-surv/gsmdetector/img_3.jpg","/products/counter-surv/gsmdetector/img_4.jpg","/products/counter-surv/gsmdetector/img_5.jpg"]'
  WHERE slug = 'gsm-4g-bug-detector-tap-finder-pro';

UPDATE products SET
  featured_image = '/products/counter-surv/tapdetector/img_1.jpg',
  gallery_images = '["/products/counter-surv/tapdetector/img_1.jpg","/products/counter-surv/tapdetector/img_2.jpg","/products/counter-surv/tapdetector/img_3.jpg","/products/counter-surv/tapdetector/img_4.jpg","/products/counter-surv/tapdetector/img_5.jpg"]'
  WHERE slug = 'telephone-line-tap-detector-scrambler';

UPDATE products SET
  featured_image = '/products/counter-surv/tscmkit/img_1.jpg',
  gallery_images = '["/products/counter-surv/tscmkit/img_1.jpg","/products/counter-surv/tscmkit/img_2.jpg","/products/counter-surv/tscmkit/img_3.png","/products/counter-surv/tscmkit/img_4.jpg","/products/counter-surv/tscmkit/img_5.png"]'
  WHERE slug = 'tscm-sweep-kit-professional';

UPDATE products SET
  featured_image = '/products/rf-detectors/bugsweeper/img_1.jpg',
  gallery_images = '["/products/rf-detectors/bugsweeper/img_1.jpg","/products/rf-detectors/bugsweeper/img_2.jpg","/products/rf-detectors/bugsweeper/img_3.jpg","/products/rf-detectors/bugsweeper/img_4.jpg","/products/rf-detectors/bugsweeper/img_5.jpg"]'
  WHERE slug = 'multi-band-bug-sweeper-1mhz-12ghz-professional';

UPDATE products SET
  featured_image = '/products/rf-detectors/camdetector/img_1.jpg',
  gallery_images = '["/products/rf-detectors/camdetector/img_1.jpg","/products/rf-detectors/camdetector/img_2.jpg","/products/rf-detectors/camdetector/img_3.jpg","/products/rf-detectors/camdetector/img_4.jpg","/products/rf-detectors/camdetector/img_5.jpg"]'
  WHERE slug = 'wireless-hidden-camera-detector-wifi-spy';

UPDATE products SET
  featured_image = '/products/rf-detectors/nljd/img_1.jpg',
  gallery_images = '["/products/rf-detectors/nljd/img_1.jpg","/products/rf-detectors/nljd/img_2.jpg","/products/rf-detectors/nljd/img_3.jpg","/products/rf-detectors/nljd/img_4.jpg","/products/rf-detectors/nljd/img_5.jpg"]'
  WHERE slug = 'non-linear-junction-detector-nljd';

UPDATE products SET
  featured_image = '/products/rf-detectors/phonedetector/img_1.jpg',
  gallery_images = '["/products/rf-detectors/phonedetector/img_1.jpg","/products/rf-detectors/phonedetector/img_2.jpg","/products/rf-detectors/phonedetector/img_3.jpg","/products/rf-detectors/phonedetector/img_4.png","/products/rf-detectors/phonedetector/img_5.jpg"]'
  WHERE slug = 'cell-phone-detector-unauthorized-mobile';

UPDATE products SET
  featured_image = '/products/rf-detectors/rfexplorer/img_1.jpg',
  gallery_images = '["/products/rf-detectors/rfexplorer/img_1.jpg","/products/rf-detectors/rfexplorer/img_2.jpg","/products/rf-detectors/rfexplorer/img_3.jpg","/products/rf-detectors/rfexplorer/img_4.jpg","/products/rf-detectors/rfexplorer/img_5.jpg"]'
  WHERE slug = 'rf-explorer-6g-combo-spectrum-analyzer';

UPDATE products SET
  featured_image = '/products/covert-comms/bodyworn/img_1.jpg',
  gallery_images = '["/products/covert-comms/bodyworn/img_1.jpg","/products/covert-comms/bodyworn/img_2.jpg","/products/covert-comms/bodyworn/img_3.jpg","/products/covert-comms/bodyworn/img_4.jpg","/products/covert-comms/bodyworn/img_5.jpg"]'
  WHERE slug = 'mini-covert-body-worn-radio-concealable';

UPDATE products SET
  featured_image = '/products/covert-comms/earpiece/img_1.jpg',
  gallery_images = '["/products/covert-comms/earpiece/img_1.jpg","/products/covert-comms/earpiece/img_2.jpg","/products/covert-comms/earpiece/img_3.jpg","/products/covert-comms/earpiece/img_4.jpg","/products/covert-comms/earpiece/img_5.jpg"]'
  WHERE slug = 'covert-surveillance-earpiece-kit-single-wire';

UPDATE products SET
  featured_image = '/products/covert-comms/pocradio/img_1.jpg',
  gallery_images = '["/products/covert-comms/pocradio/img_1.jpg","/products/covert-comms/pocradio/img_2.jpg","/products/covert-comms/pocradio/img_3.jpg","/products/covert-comms/pocradio/img_4.jpg","/products/covert-comms/pocradio/img_5.jpg"]'
  WHERE slug = 'encrypted-poc-radio-4g-lte-network';

UPDATE products SET
  featured_image = '/products/covert-comms/tacradio/img_1.jpg',
  gallery_images = '["/products/covert-comms/tacradio/img_1.jpg","/products/covert-comms/tacradio/img_2.jpg","/products/covert-comms/tacradio/img_3.jpg","/products/covert-comms/tacradio/img_4.jpg","/products/covert-comms/tacradio/img_5.jpg"]'
  WHERE slug = 'encrypted-tactical-radio-aes256-vhf-uhf';

UPDATE products SET
  featured_image = '/products/covert-comms/throatmic/img_1.jpg',
  gallery_images = '["/products/covert-comms/throatmic/img_1.jpg","/products/covert-comms/throatmic/img_2.jpg","/products/covert-comms/throatmic/img_3.jpg","/products/covert-comms/throatmic/img_4.jpg","/products/covert-comms/throatmic/img_5.jpg"]'
  WHERE slug = 'bone-conduction-throat-microphone-tactical';

UPDATE products SET
  featured_image = '/products/spytec/charger/img_1.jpg',
  gallery_images = '["/products/spytec/charger/img_1.jpg","/products/spytec/charger/img_2.png","/products/spytec/charger/img_3.jpg","/products/spytec/charger/img_4.jpg","/products/spytec/charger/img_5.jpg"]'
  WHERE slug = 'usb-wall-charger-spy-camera-wifi';

UPDATE products SET
  featured_image = '/products/spytec/clock/img_1.jpg',
  gallery_images = '["/products/spytec/clock/img_1.jpg","/products/spytec/clock/img_2.jpg","/products/spytec/clock/img_3.jpg","/products/spytec/clock/img_4.jpg","/products/spytec/clock/img_5.jpg"]'
  WHERE slug = 'wall-clock-spy-camera-1080p-wifi';

UPDATE products SET
  featured_image = '/products/spytec/glasses/img_1.jpg',
  gallery_images = '["/products/spytec/glasses/img_1.jpg","/products/spytec/glasses/img_2.jpg","/products/spytec/glasses/img_3.jpg","/products/spytec/glasses/img_4.png","/products/spytec/glasses/img_5.jpg"]'
  WHERE slug = 'spy-glasses-camera-hd-sunglasses';

UPDATE products SET
  featured_image = '/products/spytec/pen/img_1.jpg',
  gallery_images = '["/products/spytec/pen/img_1.jpg","/products/spytec/pen/img_2.jpg","/products/spytec/pen/img_3.jpg","/products/spytec/pen/img_4.jpg","/products/spytec/pen/img_5.jpg"]'
  WHERE slug = 'spy-pen-camera-hd-1080p';

UPDATE products SET
  featured_image = '/products/spytec/powerbank/img_1.jpg',
  gallery_images = '["/products/spytec/powerbank/img_1.jpg","/products/spytec/powerbank/img_2.jpg","/products/spytec/powerbank/img_3.jpg","/products/spytec/powerbank/img_4.jpg","/products/spytec/powerbank/img_5.jpg"]'
  WHERE slug = 'power-bank-hidden-spy-camera-10000mah';

UPDATE products SET
  featured_image = '/products/spytec/usb/img_1.jpg',
  gallery_images = '["/products/spytec/usb/img_1.jpg","/products/spytec/usb/img_2.jpg","/products/spytec/usb/img_3.png","/products/spytec/usb/img_4.jpg","/products/spytec/usb/img_5.jpg"]'
  WHERE slug = 'usb-flash-drive-spy-camera-1080p';

UPDATE products SET
  featured_image = '/products/smartphones/a54/img_1.png',
  gallery_images = '["/products/smartphones/a54/img_1.png","/products/smartphones/a54/img_2.png","/products/smartphones/a54/img_3.png","/products/smartphones/a54/img_4.png","/products/smartphones/a54/img_5.png"]'
  WHERE slug = 'samsung-galaxy-a54-5g-128gb';

UPDATE products SET
  featured_image = '/products/smartphones/iphone14/img_1.png',
  gallery_images = '["/products/smartphones/iphone14/img_1.png","/products/smartphones/iphone14/img_2.jpg","/products/smartphones/iphone14/img_3.jpg","/products/smartphones/iphone14/img_4.png","/products/smartphones/iphone14/img_5.jpg"]'
  WHERE slug = 'apple-iphone-14-128gb-midnight';

UPDATE products SET
  featured_image = '/products/smartphones/iphone15pro/img_1.jpg',
  gallery_images = '["/products/smartphones/iphone15pro/img_1.jpg","/products/smartphones/iphone15pro/img_2.jpg","/products/smartphones/iphone15pro/img_3.jpg","/products/smartphones/iphone15pro/img_4.jpg","/products/smartphones/iphone15pro/img_5.jpg"]'
  WHERE slug = 'apple-iphone-15-pro-256gb';

UPDATE products SET
  featured_image = '/products/smartphones/nova12pro/img_1.jpg',
  gallery_images = '["/products/smartphones/nova12pro/img_1.jpg","/products/smartphones/nova12pro/img_2.jpg","/products/smartphones/nova12pro/img_3.jpg","/products/smartphones/nova12pro/img_4.jpg","/products/smartphones/nova12pro/img_5.jpg"]'
  WHERE slug = 'huawei-nova-12-pro-256gb';

UPDATE products SET
  featured_image = '/products/smartphones/s24ultra/img_1.jpg',
  gallery_images = '["/products/smartphones/s24ultra/img_1.jpg","/products/smartphones/s24ultra/img_2.jpg","/products/smartphones/s24ultra/img_3.jpg","/products/smartphones/s24ultra/img_4.jpg","/products/smartphones/s24ultra/img_5.jpg"]'
  WHERE slug = 'samsung-galaxy-s24-ultra-256gb';

UPDATE products SET
  featured_image = '/products/smartphones/xiaomi14pro/img_1.jpg',
  gallery_images = '["/products/smartphones/xiaomi14pro/img_1.jpg","/products/smartphones/xiaomi14pro/img_2.jpg","/products/smartphones/xiaomi14pro/img_3.jpg","/products/smartphones/xiaomi14pro/img_4.jpg"]'
  WHERE slug = 'xiaomi-14-pro-512gb';

UPDATE products SET
  featured_image = '/products/lawmate/ar100/img_1.jpg',
  gallery_images = '["/products/lawmate/ar100/img_1.jpg","/products/lawmate/ar100/img_2.jpg","/products/lawmate/ar100/img_3.jpg","/products/lawmate/ar100/img_4.jpg","/products/lawmate/ar100/img_5.jpg"]'
  WHERE slug = 'lawmate-ar-100';

UPDATE products SET
  featured_image = '/products/lawmate/ar300/img_1.jpg',
  gallery_images = '["/products/lawmate/ar300/img_1.jpg","/products/lawmate/ar300/img_2.jpg","/products/lawmate/ar300/img_3.jpg","/products/lawmate/ar300/img_4.jpg","/products/lawmate/ar300/img_5.jpg"]'
  WHERE slug = 'lawmate-ar-300';

UPDATE products SET
  featured_image = '/products/lawmate/bu18hd/img_1.jpg',
  gallery_images = '["/products/lawmate/bu18hd/img_1.jpg","/products/lawmate/bu18hd/img_2.jpg","/products/lawmate/bu18hd/img_3.jpg","/products/lawmate/bu18hd/img_4.jpg","/products/lawmate/bu18hd/img_5.jpg"]'
  WHERE slug = 'lawmate-bu-18hd-mini-bullet-camera';

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
  featured_image = '/products/lawmate/cmdbu20lx/img_1.jpg',
  gallery_images = '["/products/lawmate/cmdbu20lx/img_1.jpg","/products/lawmate/cmdbu20lx/img_2.jpg","/products/lawmate/cmdbu20lx/img_3.jpg","/products/lawmate/cmdbu20lx/img_4.jpg","/products/lawmate/cmdbu20lx/img_5.jpg"]'
  WHERE slug = 'lawmate-cmd-bu20lx';

UPDATE products SET
  featured_image = '/products/lawmate/cmtc10/img_1.jpg',
  gallery_images = '["/products/lawmate/cmtc10/img_1.jpg","/products/lawmate/cmtc10/img_2.jpg","/products/lawmate/cmtc10/img_3.jpg","/products/lawmate/cmtc10/img_4.jpg","/products/lawmate/cmtc10/img_5.jpg"]'
  WHERE slug = 'lawmate-cm-tc10';

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
  featured_image = '/products/lawmate/pv500eco2/img_1.jpg',
  gallery_images = '["/products/lawmate/pv500eco2/img_1.jpg","/products/lawmate/pv500eco2/img_2.jpg","/products/lawmate/pv500eco2/img_3.jpg","/products/lawmate/pv500eco2/img_4.jpg","/products/lawmate/pv500eco2/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-500eco2';

UPDATE products SET
  featured_image = '/products/lawmate/pv500l4i/img_1.jpg',
  gallery_images = '["/products/lawmate/pv500l4i/img_1.jpg","/products/lawmate/pv500l4i/img_2.jpg","/products/lawmate/pv500l4i/img_3.jpg","/products/lawmate/pv500l4i/img_4.jpg"]'
  WHERE slug = 'lawmate-pv-500-l4i';

UPDATE products SET
  featured_image = '/products/lawmate/pv500lite3/img_1.jpg',
  gallery_images = '["/products/lawmate/pv500lite3/img_1.jpg","/products/lawmate/pv500lite3/img_2.jpg","/products/lawmate/pv500lite3/img_3.jpg","/products/lawmate/pv500lite3/img_4.jpg","/products/lawmate/pv500lite3/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-500-lite-3';

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
  gallery_images = '["/products/lawmate/pvap10i/img_1.jpg","/products/lawmate/pvap10i/img_2.png","/products/lawmate/pvap10i/img_3.jpg","/products/lawmate/pvap10i/img_4.jpg","/products/lawmate/pvap10i/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-ap10i';

UPDATE products SET
  featured_image = '/products/lawmate/pvbc10hd/img_1.jpg',
  gallery_images = '["/products/lawmate/pvbc10hd/img_1.jpg","/products/lawmate/pvbc10hd/img_2.jpg","/products/lawmate/pvbc10hd/img_3.jpg","/products/lawmate/pvbc10hd/img_4.jpg","/products/lawmate/pvbc10hd/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-bc10hd-button-spy-camera';

UPDATE products SET
  featured_image = '/products/lawmate/pvbt10i/img_1.jpg',
  gallery_images = '["/products/lawmate/pvbt10i/img_1.jpg","/products/lawmate/pvbt10i/img_2.jpg","/products/lawmate/pvbt10i/img_3.jpg","/products/lawmate/pvbt10i/img_4.jpg","/products/lawmate/pvbt10i/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-bt10i';

UPDATE products SET
  featured_image = '/products/lawmate/pvcc10w/img_1.jpg',
  gallery_images = '["/products/lawmate/pvcc10w/img_1.jpg","/products/lawmate/pvcc10w/img_2.jpg","/products/lawmate/pvcc10w/img_3.jpg","/products/lawmate/pvcc10w/img_4.jpg","/products/lawmate/pvcc10w/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-cc10w';

UPDATE products SET
  featured_image = '/products/lawmate/pvchg30i/img_1.jpg',
  gallery_images = '["/products/lawmate/pvchg30i/img_1.jpg","/products/lawmate/pvchg30i/img_2.jpg","/products/lawmate/pvchg30i/img_3.jpg","/products/lawmate/pvchg30i/img_4.jpg","/products/lawmate/pvchg30i/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-chg30i';

UPDATE products SET
  featured_image = '/products/lawmate/pvcm10i/img_1.jpg',
  gallery_images = '["/products/lawmate/pvcm10i/img_1.jpg","/products/lawmate/pvcm10i/img_2.jpg","/products/lawmate/pvcm10i/img_3.jpg","/products/lawmate/pvcm10i/img_4.jpg","/products/lawmate/pvcm10i/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-cm10i-coffee-mug-spy-camera';

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
  gallery_images = '["/products/lawmate/pveg10cl/img_1.jpg","/products/lawmate/pveg10cl/img_2.jpg","/products/lawmate/pveg10cl/img_3.png","/products/lawmate/pveg10cl/img_4.png","/products/lawmate/pveg10cl/img_5.png"]'
  WHERE slug = 'lawmate-pv-eg10cl';

UPDATE products SET
  featured_image = '/products/lawmate/pvfm20hdwi/img_1.jpg',
  gallery_images = '["/products/lawmate/pvfm20hdwi/img_1.jpg","/products/lawmate/pvfm20hdwi/img_2.jpg","/products/lawmate/pvfm20hdwi/img_3.jpg","/products/lawmate/pvfm20hdwi/img_4.jpg","/products/lawmate/pvfm20hdwi/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-fm20hdwi';

UPDATE products SET
  featured_image = '/products/lawmate/pvnb10w/img_1.jpg',
  gallery_images = '["/products/lawmate/pvnb10w/img_1.jpg","/products/lawmate/pvnb10w/img_2.jpg","/products/lawmate/pvnb10w/img_3.jpg","/products/lawmate/pvnb10w/img_4.jpg","/products/lawmate/pvnb10w/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-nb10w';

UPDATE products SET
  featured_image = '/products/lawmate/pvpb20i/img_1.jpg',
  gallery_images = '["/products/lawmate/pvpb20i/img_1.jpg","/products/lawmate/pvpb20i/img_2.jpg","/products/lawmate/pvpb20i/img_3.jpg","/products/lawmate/pvpb20i/img_4.png","/products/lawmate/pvpb20i/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-pb20i';

UPDATE products SET
  featured_image = '/products/lawmate/pvpb30w/img_1.jpg',
  gallery_images = '["/products/lawmate/pvpb30w/img_1.jpg","/products/lawmate/pvpb30w/img_2.jpg","/products/lawmate/pvpb30w/img_3.png","/products/lawmate/pvpb30w/img_4.jpg","/products/lawmate/pvpb30w/img_5.png"]'
  WHERE slug = 'lawmate-pv-pb30w';

UPDATE products SET
  featured_image = '/products/lawmate/pvrc10fhd/img_1.jpg',
  gallery_images = '["/products/lawmate/pvrc10fhd/img_1.jpg","/products/lawmate/pvrc10fhd/img_2.jpg","/products/lawmate/pvrc10fhd/img_3.jpg","/products/lawmate/pvrc10fhd/img_4.jpg","/products/lawmate/pvrc10fhd/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-rc10fhd';

UPDATE products SET
  featured_image = '/products/lawmate/pvrc200hd/img_1.png',
  gallery_images = '["/products/lawmate/pvrc200hd/img_1.png","/products/lawmate/pvrc200hd/img_2.jpg","/products/lawmate/pvrc200hd/img_3.png","/products/lawmate/pvrc200hd/img_4.png","/products/lawmate/pvrc200hd/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-rc200hd-car-key-fob-camera';

UPDATE products SET
  featured_image = '/products/lawmate/pvrc200hd2/img_1.png',
  gallery_images = '["/products/lawmate/pvrc200hd2/img_1.png","/products/lawmate/pvrc200hd2/img_2.png","/products/lawmate/pvrc200hd2/img_3.png","/products/lawmate/pvrc200hd2/img_4.jpg","/products/lawmate/pvrc200hd2/img_5.png"]'
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
  featured_image = '/products/lawmate/pvwt10i/img_1.jpg',
  gallery_images = '["/products/lawmate/pvwt10i/img_1.jpg","/products/lawmate/pvwt10i/img_2.jpg","/products/lawmate/pvwt10i/img_3.jpg","/products/lawmate/pvwt10i/img_4.jpg","/products/lawmate/pvwt10i/img_5.jpg"]'
  WHERE slug = 'lawmate-pv-wt10i-wristwatch-spy-camera';

UPDATE products SET
  featured_image = '/products/lawmate/pvwt20w/img_1.jpg',
  gallery_images = '["/products/lawmate/pvwt20w/img_1.jpg","/products/lawmate/pvwt20w/img_2.jpg","/products/lawmate/pvwt20w/img_3.png"]'
  WHERE slug = 'lawmate-pv-wt20w';

UPDATE products SET
  featured_image = '/products/lawmate/rd10/img_1.jpg',
  gallery_images = '["/products/lawmate/rd10/img_1.jpg","/products/lawmate/rd10/img_2.jpg","/products/lawmate/rd10/img_3.jpg","/products/lawmate/rd10/img_4.jpg","/products/lawmate/rd10/img_5.jpg"]'
  WHERE slug = 'lawmate-rd-10';

UPDATE products SET
  featured_image = '/products/lawmate/rd30/img_1.png',
  gallery_images = '["/products/lawmate/rd30/img_1.png","/products/lawmate/rd30/img_2.jpg","/products/lawmate/rd30/img_3.jpg","/products/lawmate/rd30/img_4.jpg","/products/lawmate/rd30/img_5.png"]'
  WHERE slug = 'lawmate-rd-30';

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
  gallery_images = '["/products/esonic/mqu350/img_1.jpg","/products/esonic/mqu350/img_2.jpg","/products/esonic/mqu350/img_3.jpg","/products/esonic/mqu350/img_4.jpg","/products/esonic/mqu350/img_5.jpg"]'
  WHERE slug = 'esonic-memoq-mq-u350';

UPDATE products SET
  featured_image = '/products/esonic/mq79/img_1.jpg',
  gallery_images = '["/products/esonic/mq79/img_1.jpg","/products/esonic/mq79/img_2.jpg","/products/esonic/mq79/img_3.png","/products/esonic/mq79/img_4.jpg"]'
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
  featured_image = '/products/gps/cj780.jpg',
  gallery_images = '["/products/gps/cj780.jpg","/products/gps/cj780_2.jpg"]'
  WHERE slug = 'yuntrack-cj780-4g-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/cj750.jpg',
  gallery_images = '["/products/gps/cj750.jpg","/products/gps/cj750_2.jpg"]'
  WHERE slug = 'yuntrack-cj750-obd-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/cj790d.jpg',
  gallery_images = '["/products/gps/cj790d.jpg"]'
  WHERE slug = 'yuntrack-cj790d-4g-fleet-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/s20.jpg',
  gallery_images = '["/products/gps/s20.jpg","/products/gps/s20_2.jpg","/products/gps/s20_3.jpg","/products/gps/s20_4.jpg"]'
  WHERE slug = 'wanway-s20-4g-motorcycle-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/gm06nw.jpg',
  gallery_images = '["/products/gps/gm06nw.jpg","/products/gps/gm06nw_2.jpg"]'
  WHERE slug = 'goome-gm06nw-motorcycle-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/g20.jpg',
  gallery_images = '["/products/gps/g20.jpg","/products/gps/g20_mini.jpg"]'
  WHERE slug = 'micodus-g20-magnetic-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/g20.jpg',
  gallery_images = '["/products/gps/g20.jpg","/products/gps/g20_mini.jpg"]'
  WHERE slug = 'micodus-g20m-extended-battery-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/gt06.jpg',
  gallery_images = '["/products/gps/gt06.jpg"]'
  WHERE slug = 'micodus-gt06-mini-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/gt06.jpg',
  gallery_images = '["/products/gps/gt06.jpg"]'
  WHERE slug = 'micodus-gt06-tk200-4g-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/gt06.jpg',
  gallery_images = '["/products/gps/gt06.jpg"]'
  WHERE slug = 'micodus-gt02d-4g-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/gt06.jpg',
  gallery_images = '["/products/gps/gt06.jpg"]'
  WHERE slug = 'micodus-gt02-t3-4g-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/g20.jpg',
  gallery_images = '["/products/gps/g20.jpg"]'
  WHERE slug = 'micodus-mv710g-4g-fuel-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/gs900.png',
  gallery_images = '["/products/gps/gs900.png"]'
  WHERE slug = 'wanway-gs900-motorcycle-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/lk208.jpg',
  gallery_images = '["/products/gps/lk208.jpg"]'
  WHERE slug = 'yuntrack-lk208-personal-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/st900.jpg',
  gallery_images = '["/products/gps/st900.jpg","/products/gps/st900_2.jpg"]'
  WHERE slug = 'sinotrack-st900-4g-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/st900.jpg',
  gallery_images = '["/products/gps/st900.jpg","/products/gps/st900_2.jpg"]'
  WHERE slug = 'sinotrack-st815-4g-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/cj780.jpg',
  gallery_images = '["/products/gps/cj780.jpg","/products/gps/cj780_2.jpg"]'
  WHERE slug = 'yuntrack-cj220-4g-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/gt06.jpg',
  gallery_images = '["/products/gps/gt06.jpg"]'
  WHERE slug = 'iot-universal-4g-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/lk208.jpg',
  gallery_images = '["/products/gps/lk208.jpg"]'
  WHERE slug = 'p31-portable-personal-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/gt06.jpg',
  gallery_images = '["/products/gps/gt06.jpg"]'
  WHERE slug = 'n9-gsm-4g-gps-tracker';

UPDATE products SET
  featured_image = '/products/gps/orange_sim.jpg',
  gallery_images = '["/products/gps/orange_sim.jpg","/products/gps/orange_sim2.jpg"]'
  WHERE slug = 'geem-orange-2-gps-tracker-4g-lte';

UPDATE products SET
  featured_image = '/products/gps/orange_sim.jpg',
  gallery_images = '["/products/gps/orange_sim.jpg","/products/gps/orange_sim2.jpg"]'
  WHERE slug = 'geem-orange-gps-tracker-4g';

UPDATE products SET
  featured_image = '/products/gps/td02s.jpg',
  gallery_images = '["/products/gps/td02s.jpg"]'
  WHERE slug = 'carepro-td02s-kids-gps-smartwatch';

COMMIT;