# Bazaar Boss — v13

پاکستانی سپرمارکیٹ پر مبنی ایک آف لائن 3D Android گیم۔ دکان سے باہر اگلی گلی کی منڈی میں جائیں، آڑھتی سے بھاؤ تاؤ کریں، مال ٹرک میں لوڈ کروا کر اسٹور روم منگوائیں، شیلف بھریں اور کرسی پر بیٹھ کر گاہکوں کا بل بنائیں۔

## v13 انسانی کردار، category galleries اور صاف UI اپڈیٹ

- male/female rigged کردار اب تقریباً 1.68–1.78 میٹر کے قدرتی انسانی قد میں؛ پرانا 2.68 میٹر superhero/alien scale ختم
- خواتین کی bun اور پانچ حصوں والی braid سر کے پیچھے؛ چہرے کے آگے ponytail ختم
- customer، cashier، restocker، labourer اور shelf کے screen-covering floating tags ختم؛ قریب کی static جگہ پر ہی مختصر interact hint
- 42 میٹر چوڑا اسٹور، کشادہ راستے اور تمام 15 categories کی اپنی رنگین 3D gallery، physical brand/unit/price board اور shelf
- shopping trolley کا handle انسانی ہاتھوں کی اونچائی پر؛ Push animation میں دونوں hand bones کے ساتھ مسلسل alignment
- اسٹور روم کے پاس الگ functional stock trolley؛ crate اسی پر load کرکے متعلقہ gallery تک لے جایا جاتا ہے
- checkout scan پر quantity، item، brand اور مکمل price ظاہر؛ customer کے سر پر خریداری tag نہیں
- startup پر 3D English **BAZAAR BOSS** logo، Language اور صرف Easy/Hard؛ Settings کے اندر صرف Language
- تفصیلی international research، design، performance، monetization اور release plan: `docs/BAZAAR_BOSS_INTERNATIONAL_PLAN_UR.md`

## v12 بڑا سپرمارکیٹ اور مکمل کردار/راستہ اپڈیٹ

- کاؤنٹر، شیلف یا انسان سامنے آنے پر corner detour اور کئی زاویوں سے خودکار side-step؛ قطار کے پاس پھنسنے کا مسئلہ ختم
- ٹرالی کا handle دونوں ہاتھوں کے بیچ، چھوٹے کارٹن جسم سے باہر دونوں ہاتھوں میں، جبکہ 10 کلو آٹے کا تھیلا کندھے پر
- ہر پیک کے سامنے اور پیچھے انگریزی برانڈ، مقامی چیز کا نام اور پیک سائز
- 15 grocery categories اور روز کم از کم 50 گاہک؛ ایک وقت میں زیادہ سے زیادہ 18 فعال کردار تاکہ موبائل کی رفتار برقرار رہے
- Surf Excel/Ariel، Lifebuoy/LUX/Safeguard، Sunsilk/Head & Shoulders/Pantene، National/Mehran/Shan اور Vim/Sunlight/Lemon Max کی نئی شیلفیں
- چھ مختلف 3D بالوں کے انداز، بالوں کے مختلف رنگ، کردار کے حساب سے لباس اور الگ walk speed/sway
- ہر مکمل فروخت پر کاؤنٹر کے پاس نوٹ اور سکے حقیقتاً جمع ہوتے دکھائی دیتے ہیں

## v11 مکمل 3D کپڑوں کی اپڈیٹ

- male/female base کرداروں کے جسم کے اوپر الگ bone-attached قمیض، آستین، شلوار/پینٹ اور جوتوں کی meshes
- کسٹمرز کے پاکستانی شلوار قمیض رنگ، خواتین کے لیے دوپٹہ، مالک کی واسکٹ، کیشیئر کا ایپرن، مزدور/restocker کی حفاظتی واسکٹ، ڈرائیور کی وردی اور آڑھتی کا الگ لباس
- کپڑے skeleton کے بازو، ٹانگوں، دھڑ اور پاؤں سے جڑے ہیں، اس لیے Walk، Sprint، Pick up، Push trolley، Sit اور Billing animations کے ساتھ حرکت کرتے ہیں

## v10 Android startup اور gaming visuals اپڈیٹ

- Android WebView کی CSP درست؛ packaged rigged characters اور animations اب اسی APK سے offline load ہوتے ہیں
- خالی سبز startup/error صفحے کی جگہ supermarket، trolley اور shop manager والا portrait game artwork
- گھر نما پرانے launcher icon کی جگہ premium manager، trolley، groceries اور coins والا adaptive gaming icon

## v9 حقیقی کردار، مکمل اسکرین کنٹرول اور راستہ بدلنے کی اپڈیٹ

- Quaternius کے CC0 rigged male/female کردار؛ dummy cylinder کردار ختم
- 43 skeletal actions میں سے Idle، Walk، Sprint، Push، Pick up، Interact، Sit اور Drive براہِ راست گیم میں استعمال
- انسانی رکاوٹ پر collision، خودکار side-step/overtake اور قطار/کاؤنٹر کے لیے الگ محفوظ movement
- پوری اسکرین dynamic movement: ہلکا drag چلنا، مکمل drag دوڑنا، دوسری انگلی سے camera/zoom
- ہاتھوں کے درمیان basket/crate، متحرک shopping trolley اور shelf pickup/restock animations
- نئے اور v8 سے منتقل کھیل میں شروع کی تمام شیلفیں اور اسٹور روم مکمل بھرے
- دیہاڑی: ایک مزدور ₨500، دو مزدور ₨900؛ تمام عملے کی یومیہ تنخواہ ₨1000 یا کم

- کردار اب ایک دوسرے کے اندر سے نہیں گزرتے؛ سامنے آنے پر سائیڈ لیتے اور راستہ مانگتے ہیں
- ٹرک کے لیے الگ واضح کنٹرول، نظر آنے والا ڈرائیور، اور دکان تک مکمل سفر
- ٹرک پہنچنے کے بعد 1 یا 2 دیہاڑی مزدور اجرت لے کر مال اسٹور روم میں اتارتے ہیں
- مالک ایک بار بیٹھ کر پوری قطار کے بل مسلسل بناتا ہے اور الگ بٹن سے کرسی سے اٹھتا ہے
- گیم اور Android ایپ کا نام صرف **Bazaar Boss** ہے
- پاکستانی سپر اسٹورز سے تصدیق شدہ پیک نام: Sunridge، Guard، Falak، Latif، Dalda، Sufi، Mezan، Olpers، Milkpak، Haleeb، Shan، National، Sooper، LU، Bisconni، Mitchells، Candyland اور Deemah

- پندرہ الگ grocery categories، 18/18 بھری shelves، بڑے category/brand/rate boards اور ہر پیک پر اپنا نام
- آٹا، چاول، گھی، آئل، چینی، دال، دودھ، نمک، بسکٹ اور ٹافی کے پاکستانی benchmark نرخ
- دکان کا level/XP، اپنی retail pricing، قیمت زیادہ ہونے پر گاہک کا انکار، صفائی challenge اور achievements
- کیشیئر کے ساتھ خودکار shelf worker؛ warehouse سے صحیح مال اٹھا کر متعلقہ shelf بھرتا ہے
- level کے ساتھ کھلنے والی vending machine، fruit stand اور food cart، جن کی الگ روزانہ آمدنی ہے
- بڑا store floor، offline generated material textures اور 8–30 میٹر pinch zoom camera

## گیم پلے

- زیادہ حقیقی انسانی تناسب والے تھرڈ پرسن 3D کردار، جسمانی حرکات اور چہرے کی باریک تفصیل
- پوری اسکرین dynamic walk/run control، پہلے سے زیادہ دور کیمرا اور 8–30 میٹر pinch zoom
- نیا کھیل ہر شیلف مکمل 18/18 اور اسٹور روم ہر category کے 36 پیک سے شروع ہوتا ہے
- پندرہ grocery categories کے الگ پیک ماڈل اور الگ 3D شیلف
- ہر شیلف پر چیز کا نام، تین دستیاب برانڈ، پیک سائز، روز کی فروخت قیمت اور موجودہ تعداد واضح ہے
- ہر پیکٹ پر بڑا برانڈ اور چیز کا نام؛ لطیف، ڈالڈا اور صوفی گھی، سن رج آٹا، گارڈ و فلک باسمتی اور دوسرے پاکستانی مارکیٹ نام
- گاہک مطلوبہ شیلف سے سامان اٹھاتے، باسکٹ میں رکھتے اور بلنگ کاؤنٹر پر قطار بناتے ہیں
- کاؤنٹر کی قطار میں گاہک اپنی باری تک انتظار کرتے ہیں؛ صرف خالی شیلف پر فروخت ضائع ہوتی ہے
- بلنگ کاؤنٹر پر مالک اور کیشیئر کی الگ کرسیاں، دو کمپیوٹر، keyboard، scanner اور ہاتھ چلانے کی animation
- منڈی دکان سے باہر اگلی گلی میں؛ آڑھتی، منڈی کے سٹال، تین درجوں کا بھاؤ تاؤ اور نظر آنے والا cargo truck
- خریدا مال پہلے ٹرک میں لوڈ ہوتا ہے، کاروباری بجٹ سے کرایہ ادا ہوتا ہے، ٹرک چل کر دکان پہنچتا ہے اور دیہاڑی مزدور اسے اسٹور روم میں اتارتے ہیں
- اسٹور روم کی stock trolley میں کریٹ رکھ کر صحیح category gallery کی شیلف تک لے جانے کا مکمل physical restocking loop
- سیلز فنڈ اور کاروباری بجٹ بالکل الگ: فروخت صرف نئے مال کا فنڈ بناتی ہے، جبکہ عملہ، تنخواہ، ٹرک کرایہ اور اپ گریڈ بجٹ سے ہوتے ہیں
- کافی رقم جمع ہونے پر سیلز مین/کیشیئر رکھنے اور اس کی رفتار اپ گریڈ کرنے کا نظام
- کیشیئر کی روزانہ تنخواہ، خودکار بلنگ، سب سے لمبی قطار اور کم اسٹاک وارننگ
- پاکستانی مارکیٹ کے ریفرنس نرخ، الگ خرید/فروخت قیمت اور ہر نئے دن محدود بدلتے نرخ
- اسکیننگ ٹائمر، زیادہ روزانہ گاہک، دکان کا خرچ، انعام اور اگلا دن
- شادی، راشن، سکول، مہنگائی اور رش کے واقعات
- بڑی شیلف، تیز اسکینر اور بہتر سجاوٹ کے مستقل اپ گریڈ
- آغاز پر آسان یا مشکل درجے
- مکمل اردو، ہندی اور انگریزی انٹرفیس
- پیش رفت خود محفوظ اور پورا کھیل آف لائن

## کنٹرول

- اسکرین پر کہیں بھی پہلی انگلی کھینچیں: ہلکا drag چلنا، مکمل drag دوڑنا
- دوسری انگلی پھیریں: کیمرہ گھمائیں؛ دونوں انگلیوں سے 8–30 میٹر zoom کریں
- دائیں بڑا بٹن: قریب موجود منڈی، اسٹور روم، شیلف یا کاؤنٹر استعمال کریں
- کمپیوٹر پر ٹیسٹ: `WASD` یا arrow keys سے چلیں، `E` سے کام کریں

## APK ڈاؤن لوڈ

1. GitHub میں **Actions** کھولیں۔
2. تازہ ترین **Build Android APK** رن منتخب کریں۔
3. **Artifacts** میں `Bazaar-Boss-Pakistan-APK` دبائیں۔
4. ZIP سے `Bazaar-Boss-Pakistan.apk` نکال کر موبائل میں انسٹال کریں۔

## مقامی تعمیر اور ٹیسٹ

```bash
npm run check
./gradlew assembleDebug
```

APK یہاں بنے گی:

`app/build/outputs/apk/debug/app-debug.apk`

3D رینڈرنگ کے لیے Three.js استعمال ہوا ہے؛ اس کا MIT لائسنس `app/src/main/assets/THREE-LICENSE.txt` میں شامل ہے۔ Quaternius کردار/حرکات کے CC0 ماخذ اور اجازت نامے کا نوٹس `app/src/main/assets/models/quaternius/QUATERNIUS-CC0-NOTICE.txt` میں ہے۔

## قیمتوں کا ریفرنس

آف لائن گیم کے بنیادی نرخ [20 اگست 2026 کے پاکستان بیورو آف اسٹیٹسٹکس Weekly SPI](https://www.pbs.gov.pk/weekly-sensitive-price-indicator-spi-for-the-week-ended-on-20-08-2026/) کے قومی اوسط اور پاکستانی retail benchmarks کے مطابق رکھے گئے ہیں۔ یہ لائیو آن لائن فیڈ نہیں؛ گیم ہر نئے دن انہی بنیادوں پر محدود اتار چڑھاؤ پیدا کرتی ہے۔
