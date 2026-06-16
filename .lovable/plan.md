## التغييرات المطلوبة

### 1. حذف الصورة من الواجهة الأولى
- إزالة `<img heroAsset>` من `src/routes/index.tsx`
- استبدالها بعنوان نصي كبير وبادج فقط (تصميم نظيف بدون صورة)
- استخدام صورة `polone-hero.png` كأيقونة رسمية: تحديث `public/favicon.ico` + `<link rel="apple-touch-icon">` + manifest icon لتظهر كأيقونة التطبيق عند التحميل/النشر

### 2. زر المساعدة (Help) في الواجهة + شاشة العميل
**جدول جديد `help_sections`:**
- `id`, `title` (نص), `description` (نص طويل), `video_url` (نص اختياري), `sort_order`, `is_active`, timestamps
- RLS: قراءة عامة (anon + authenticated)، كتابة/تعديل/حذف للأدمن فقط

**واجهة العميل:**
- زر دائري شفاف بجانب `LanguageSwitch` في `src/routes/index.tsx` + `src/components/client-app.tsx` (هيدر العميل)
- عند الضغط → Sheet/Dialog يعرض قائمة الأقسام؛ بالضغط على قسم يفتح accordion يعرض الوصف + فيديو مضمّن (iframe إذا كان YouTube/رابط، أو `<video>`)

**واجهة الأدمن (`src/routes/_authenticated/admin.tsx`):**
- تبويب/قسم "أقسام المساعدة": إضافة/تعديل/حذف/تفعيل أقسام (عنوان، وصف، رابط فيديو، ترتيب)

### 3. زر "تغيير الباقة" في صفحة البيت
**جدول جديد `package_change_requests`:**
- `id`, `user_id`, `from_package_id`, `to_package_id`, `points_required` (الفرق بالنقاط)، `note` (وصف العميل), `status` (pending/approved/rejected), `admin_note`, timestamps
- RLS: العميل يقرأ ويُنشئ طلباته فقط؛ الأدمن يقرأ/يحدّث الكل
- GRANTs

**دالة RPC `request_package_change(_user_id, _to_package_id, _note)`:**
- يتحقق من وجود باقة حالية فعّالة
- يحسب فرق السعر (نقاط) — يجب أن يكون رصيد العميل ≥ الفرق (وإذا كانت الباقة الجديدة أرخص، لا حاجة لخصم)
- يرفض الطلب إذا كان هناك طلب pending
- يُنشئ الطلب فقط (لا يخصم النقاط — الخصم بعد موافقة الأدمن)

**دالة RPC `approve_package_change(_request_id)` / `reject_package_change(_request_id, _admin_note)`:**
- عند الموافقة: يخصم الفرق إذا كان موجبًا، ويُحدّث `profiles.package_id` والـ `activated_at = now()`، ويعلّم الطلب approved
- عند الرفض: فقط تحديث الحالة

**واجهة العميل (`HomeTab` في `src/components/client-app.tsx`):**
- زر "تغيير الباقة" بجانب "السجل اليومي"
- عند الضغط → Dialog يعرض الباقات المتاحة (ما عدا الحالية)، اختيار + حقل وصف + زر إرسال
- يعرض حالة آخر طلب (pending/مرفوض)

**واجهة الأدمن:**
- قسم جديد "طلبات تغيير الباقة": قائمة بالطلبات pending مع أزرار قبول/رفض + حقل ملاحظة عند الرفض

### الملفات المتأثرة
- **Migrations جديدة**: إنشاء `help_sections` + `package_change_requests` + الدوال
- `src/routes/index.tsx` — حذف صورة + زر مساعدة
- `src/components/client-app.tsx` — زر مساعدة في الهيدر + زر تغيير الباقة في `HomeTab` + Dialog
- `src/routes/_authenticated/admin.tsx` — قسم أقسام المساعدة + قسم طلبات تغيير الباقة
- `index.html` / `public/` — تحديث favicon/apple-touch-icon من صورة polone-hero

### ملاحظة
سيكون هذا تغييرًا كبيرًا في الـ migrations والكود. هل تريد المتابعة بهذا الشكل، أم تفضل أن أبدأ بميزة واحدة فقط الآن (مثلاً المساعدة) ثم الباقي بعدها؟
