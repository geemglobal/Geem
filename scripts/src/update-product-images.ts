/**
 * update-product-images.ts
 * Updates product featured + gallery images by slug using real downloaded product photos.
 */
import { db, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const imageMap: Record<string, string[]> = {
  // ── SMARTPHONES ──
  "apple-iphone-15-pro-256gb": [
    "/products/smartphones/iphone15pro/img_1.jpg",
    "/products/smartphones/iphone15pro/img_2.jpg",
    "/products/smartphones/iphone15pro/img_3.jpg",
    "/products/smartphones/iphone15pro/img_4.jpg",
  ],
  "apple-iphone-14-128gb-midnight": [
    "/products/smartphones/iphone14/img_1.png",
    "/products/smartphones/iphone14/img_2.jpg",
    "/products/smartphones/iphone14/img_3.jpg",
    "/products/smartphones/iphone14/img_4.png",
    "/products/smartphones/iphone14/img_5.jpg",
  ],
  "samsung-galaxy-s24-ultra-256gb": [
    "/products/smartphones/s24ultra/img_1.jpg",
    "/products/smartphones/s24ultra/img_2.jpg",
    "/products/smartphones/s24ultra/img_3.jpg",
    "/products/smartphones/s24ultra/img_4.jpg",
    "/products/smartphones/s24ultra/img_5.jpg",
  ],
  "samsung-galaxy-a54-5g-128gb": [
    "/products/smartphones/a54/img_1.jpg",
    "/products/smartphones/a54/img_2.jpg",
    "/products/smartphones/a54/img_3.jpg",
    "/products/smartphones/a54/img_4.jpg",
    "/products/smartphones/a54/img_5.jpg",
  ],
  "xiaomi-14-pro-512gb": [
    "/products/smartphones/xiaomi14pro/img_1.jpg",
    "/products/smartphones/xiaomi14pro/img_2.jpg",
    "/products/smartphones/xiaomi14pro/img_3.jpg",
    "/products/smartphones/xiaomi14pro/img_4.jpg",
  ],
  "huawei-nova-12-pro-256gb": [
    "/products/smartphones/nova12pro/img_1.jpg",
    "/products/smartphones/nova12pro/img_2.jpg",
    "/products/smartphones/nova12pro/img_3.jpg",
    "/products/smartphones/nova12pro/img_4.jpg",
  ],

  // ── LAWMATE SPY CAMERAS ──
  "lawmate-pv-rc200hd-car-key-fob-camera": [
    "/products/lawmate/pvrc200hd/img_1.jpg",
    "/products/lawmate/pvrc200hd/img_2.jpg",
    "/products/lawmate/pvrc200hd/img_3.jpg",
    "/products/lawmate/pvrc200hd/img_4.jpg",
    "/products/lawmate/pvrc200hd/img_5.jpg",
  ],
  "lawmate-pv-cm10i-coffee-mug-spy-camera": [
    "/products/lawmate/pvcm10i/img_1.jpg",
    "/products/lawmate/pvcm10i/img_2.jpg",
    "/products/lawmate/pvcm10i/img_3.jpg",
    "/products/lawmate/pvcm10i/img_4.jpg",
    "/products/lawmate/pvcm10i/img_5.jpg",
  ],
  "lawmate-pv-wt10i-wristwatch-spy-camera": [
    "/products/lawmate/pvwt10i/img_1.jpg",
    "/products/lawmate/pvwt10i/img_2.jpg",
    "/products/lawmate/pvwt10i/img_3.jpg",
    "/products/lawmate/pvwt10i/img_4.jpg",
    "/products/lawmate/pvwt10i/img_5.jpg",
  ],
  "lawmate-pv-bc10hd-button-spy-camera": [
    "/products/lawmate/pvbc10hd/img_1.jpg",
    "/products/lawmate/pvbc10hd/img_2.jpg",
    "/products/lawmate/pvbc10hd/img_3.jpg",
    "/products/lawmate/pvbc10hd/img_4.jpg",
    "/products/lawmate/pvbc10hd/img_5.jpg",
  ],
  "lawmate-bu-18hd-mini-bullet-camera": [
    "/products/lawmate/bu18hd/img_1.jpg",
    "/products/lawmate/bu18hd/img_2.jpg",
    "/products/lawmate/bu18hd/img_3.jpg",
    "/products/lawmate/bu18hd/img_4.jpg",
    "/products/lawmate/bu18hd/img_5.jpg",
  ],

  // ── GENERIC SPY CAMERAS ──
  "spy-pen-camera-hd-1080p": [
    "/products/spytec/pen/img_1.jpg",
    "/products/spytec/pen/img_2.jpg",
    "/products/spytec/pen/img_3.jpg",
    "/products/spytec/pen/img_4.jpg",
    "/products/spytec/pen/img_5.jpg",
  ],
  "wall-clock-spy-camera-1080p-wifi": [
    "/products/spytec/clock/img_1.jpg",
    "/products/spytec/clock/img_2.jpg",
    "/products/spytec/clock/img_3.jpg",
    "/products/spytec/clock/img_4.jpg",
    "/products/spytec/clock/img_5.jpg",
  ],
  "spy-glasses-camera-hd-sunglasses": [
    "/products/spytec/glasses/img_1.jpg",
    "/products/spytec/glasses/img_2.jpg",
    "/products/spytec/glasses/img_3.jpg",
    "/products/spytec/glasses/img_4.jpg",
    "/products/spytec/glasses/img_5.jpg",
  ],
  "power-bank-hidden-spy-camera-10000mah": [
    "/products/spytec/powerbank/img_1.jpg",
    "/products/spytec/powerbank/img_2.jpg",
    "/products/spytec/powerbank/img_3.jpg",
    "/products/spytec/powerbank/img_4.jpg",
    "/products/spytec/powerbank/img_5.jpg",
  ],
  "usb-wall-charger-spy-camera-wifi": [
    "/products/spytec/charger/img_1.jpg",
    "/products/spytec/charger/img_2.png",
    "/products/spytec/charger/img_3.jpg",
    "/products/spytec/charger/img_4.jpg",
    "/products/spytec/charger/img_5.jpg",
  ],
  "usb-flash-drive-spy-camera-1080p": [
    "/products/spytec/usb/img_1.jpg",
    "/products/spytec/usb/img_2.jpg",
    "/products/spytec/usb/img_3.png",
    "/products/spytec/usb/img_4.jpg",
    "/products/spytec/usb/img_5.jpg",
  ],

  // ── COUNTER-SURVEILLANCE ──
  "professional-rf-bug-detector-camera-finder": [
    "/products/counter-surv/rfdetector/img_1.jpg",
    "/products/counter-surv/rfdetector/img_2.jpg",
    "/products/counter-surv/rfdetector/img_3.jpg",
    "/products/counter-surv/rfdetector/img_4.jpg",
    "/products/counter-surv/rfdetector/img_5.jpg",
  ],
  "gsm-4g-bug-detector-tap-finder-pro": [
    "/products/counter-surv/gsmdetector/img_1.jpg",
    "/products/counter-surv/gsmdetector/img_2.jpg",
    "/products/counter-surv/gsmdetector/img_3.jpg",
    "/products/counter-surv/gsmdetector/img_4.jpg",
    "/products/counter-surv/gsmdetector/img_5.jpg",
  ],
  "camera-lens-finder-pinhole-detector": [
    "/products/counter-surv/lensfinder/img_1.jpg",
    "/products/counter-surv/lensfinder/img_2.jpg",
    "/products/counter-surv/lensfinder/img_3.png",
    "/products/counter-surv/lensfinder/img_4.png",
    "/products/counter-surv/lensfinder/img_5.jpg",
  ],
  "telephone-line-tap-detector-scrambler": [
    "/products/counter-surv/tapdetector/img_1.jpg",
    "/products/counter-surv/tapdetector/img_2.jpg",
    "/products/counter-surv/tapdetector/img_3.jpg",
    "/products/counter-surv/tapdetector/img_4.jpg",
    "/products/counter-surv/tapdetector/img_5.jpg",
  ],
  "tscm-sweep-kit-professional": [
    "/products/counter-surv/tscmkit/img_1.jpg",
    "/products/counter-surv/tscmkit/img_2.jpg",
    "/products/counter-surv/tscmkit/img_3.png",
    "/products/counter-surv/tscmkit/img_4.jpg",
    "/products/counter-surv/tscmkit/img_5.png",
  ],

  // ── COVERT COMMUNICATIONS ──
  "encrypted-tactical-radio-aes256-vhf-uhf": [
    "/products/covert-comms/tacradio/img_1.jpg",
    "/products/covert-comms/tacradio/img_2.jpg",
    "/products/covert-comms/tacradio/img_3.jpg",
    "/products/covert-comms/tacradio/img_4.jpg",
    "/products/covert-comms/tacradio/img_5.jpg",
  ],
  "covert-surveillance-earpiece-kit-single-wire": [
    "/products/covert-comms/earpiece/img_1.jpg",
    "/products/covert-comms/earpiece/img_2.jpg",
    "/products/covert-comms/earpiece/img_3.jpg",
    "/products/covert-comms/earpiece/img_4.jpg",
    "/products/covert-comms/earpiece/img_5.jpg",
  ],
  "bone-conduction-throat-microphone-tactical": [
    "/products/covert-comms/throatmic/img_1.jpg",
    "/products/covert-comms/throatmic/img_2.jpg",
    "/products/covert-comms/throatmic/img_3.jpg",
    "/products/covert-comms/throatmic/img_4.jpg",
    "/products/covert-comms/throatmic/img_5.jpg",
  ],
  "encrypted-poc-radio-4g-lte-network": [
    "/products/covert-comms/pocradio/img_1.jpg",
    "/products/covert-comms/pocradio/img_2.jpg",
    "/products/covert-comms/pocradio/img_3.jpg",
    "/products/covert-comms/pocradio/img_4.jpg",
    "/products/covert-comms/pocradio/img_5.jpg",
  ],
  "mini-covert-body-worn-radio-concealable": [
    "/products/covert-comms/bodyworn/img_1.jpg",
    "/products/covert-comms/bodyworn/img_2.jpg",
    "/products/covert-comms/bodyworn/img_3.jpg",
    "/products/covert-comms/bodyworn/img_4.jpg",
    "/products/covert-comms/bodyworn/img_5.jpg",
  ],

  // ── SECURITY EQUIPMENT ──
  "ajax-hub2-wireless-smart-alarm-starter-kit": [
    "/products/security/ajaxhub2/img_1.jpg",
    "/products/security/ajaxhub2/img_2.jpg",
    "/products/security/ajaxhub2/img_3.jpg",
    "/products/security/ajaxhub2/img_4.jpg",
    "/products/security/ajaxhub2/img_5.jpg",
  ],
  "biometric-fingerprint-access-controller-rfid": [
    "/products/security/biometric/img_1.png",
    "/products/security/biometric/img_2.jpg",
    "/products/security/biometric/img_3.jpg",
    "/products/security/biometric/img_4.jpg",
    "/products/security/biometric/img_5.jpg",
  ],
  "electromagnetic-door-lock-600lbs": [
    "/products/security/emlock/img_1.jpg",
    "/products/security/emlock/img_2.jpg",
    "/products/security/emlock/img_3.jpg",
    "/products/security/emlock/img_4.jpg",
    "/products/security/emlock/img_5.jpg",
  ],
  "paradox-sp65-alarm-panel-8-zone": [
    "/products/security/paradoxsp65/img_1.jpg",
    "/products/security/paradoxsp65/img_2.jpg",
    "/products/security/paradoxsp65/img_3.jpg",
    "/products/security/paradoxsp65/img_4.jpg",
    "/products/security/paradoxsp65/img_5.jpg",
  ],
  "hikvision-video-door-intercom-ds-kv8113": [
    "/products/security/hikvintercom/img_1.jpg",
    "/products/security/hikvintercom/img_2.jpg",
    "/products/security/hikvintercom/img_3.jpg",
    "/products/security/hikvintercom/img_4.jpg",
    "/products/security/hikvintercom/img_5.jpg",
  ],

  // ── SIGNAL & RF DETECTORS ──
  "rf-explorer-6g-combo-spectrum-analyzer": [
    "/products/rf-detectors/rfexplorer/img_1.jpg",
    "/products/rf-detectors/rfexplorer/img_2.jpg",
    "/products/rf-detectors/rfexplorer/img_3.jpg",
    "/products/rf-detectors/rfexplorer/img_4.jpg",
    "/products/rf-detectors/rfexplorer/img_5.jpg",
  ],
  "multi-band-bug-sweeper-1mhz-12ghz-professional": [
    "/products/rf-detectors/bugsweeper/img_1.jpg",
    "/products/rf-detectors/bugsweeper/img_2.jpg",
    "/products/rf-detectors/bugsweeper/img_3.jpg",
    "/products/rf-detectors/bugsweeper/img_4.jpg",
    "/products/rf-detectors/bugsweeper/img_5.jpg",
  ],
  "wireless-hidden-camera-detector-wifi-spy": [
    "/products/rf-detectors/camdetector/img_1.jpg",
    "/products/rf-detectors/camdetector/img_2.jpg",
    "/products/rf-detectors/camdetector/img_3.jpg",
    "/products/rf-detectors/camdetector/img_4.jpg",
    "/products/rf-detectors/camdetector/img_5.jpg",
  ],
  "non-linear-junction-detector-nljd": [
    "/products/rf-detectors/nljd/img_1.jpg",
    "/products/rf-detectors/nljd/img_2.jpg",
    "/products/rf-detectors/nljd/img_3.jpg",
    "/products/rf-detectors/nljd/img_4.jpg",
    "/products/rf-detectors/nljd/img_5.jpg",
  ],
  "cell-phone-detector-unauthorized-mobile": [
    "/products/rf-detectors/phonedetector/img_1.jpg",
    "/products/rf-detectors/phonedetector/img_2.jpg",
    "/products/rf-detectors/phonedetector/img_3.jpg",
    "/products/rf-detectors/phonedetector/img_4.png",
    "/products/rf-detectors/phonedetector/img_5.jpg",
  ],

  // ── SMART SECURITY SYSTEMS ──
  "hikvision-ds-2cd2t47g2-l-4mp-colorvu": [
    "/products/smart-security/hikvcolorvu/img_1.png",
    "/products/smart-security/hikvcolorvu/img_2.png",
    "/products/smart-security/hikvcolorvu/img_3.jpg",
    "/products/smart-security/hikvcolorvu/img_4.jpg",
    "/products/smart-security/hikvcolorvu/img_5.jpg",
  ],
  "dahua-nvr4108hs-8p-4ks3-8ch-poe-nvr": [
    "/products/smart-security/dahuanvr/img_1.jpg",
    "/products/smart-security/dahuanvr/img_2.jpg",
    "/products/smart-security/dahuanvr/img_3.jpg",
    "/products/smart-security/dahuanvr/img_4.jpg",
    "/products/smart-security/dahuanvr/img_5.jpg",
  ],
  "reolink-rlc-810a-8mp-smart-ip-camera": [
    "/products/smart-security/reolink810a/img_1.jpg",
    "/products/smart-security/reolink810a/img_2.jpg",
    "/products/smart-security/reolink810a/img_3.jpg",
    "/products/smart-security/reolink810a/img_4.jpg",
    "/products/smart-security/reolink810a/img_5.jpg",
  ],
  "smart-fingerprint-door-lock-biometric-app": [
    "/products/smart-security/smartlock/img_1.jpg",
    "/products/smart-security/smartlock/img_2.jpg",
    "/products/smart-security/smartlock/img_3.jpg",
    "/products/smart-security/smartlock/img_4.jpg",
    "/products/smart-security/smartlock/img_5.jpg",
  ],
  "hikvision-ds-7616ni-m2-16ch-4k-nvr": [
    "/products/smart-security/hikvnvr16/img_1.jpg",
    "/products/smart-security/hikvnvr16/img_2.jpg",
    "/products/smart-security/hikvnvr16/img_3.jpg",
    "/products/smart-security/hikvnvr16/img_4.jpg",
    "/products/smart-security/hikvnvr16/img_5.jpg",
  ],
};

async function main() {
  let updated = 0;
  let notFound = 0;

  for (const [slug, paths] of Object.entries(imageMap)) {
    if (paths.length === 0) { console.log(`  SKIP (no images): ${slug}`); continue; }

    const [product] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.slug, slug));

    if (!product) {
      console.log(`  NOT FOUND: ${slug}`);
      notFound++;
      continue;
    }

    const featuredImage = paths[0];
    const galleryImages = JSON.stringify(paths);

    await db
      .update(productsTable)
      .set({ featuredImage, galleryImages })
      .where(eq(productsTable.slug, slug));

    console.log(`  ✓ Updated: ${slug} (${paths.length} images)`);
    updated++;
  }

  console.log(`\nDone — updated: ${updated}, not found: ${notFound}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
