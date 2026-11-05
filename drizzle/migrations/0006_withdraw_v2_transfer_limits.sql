ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USDT';

CREATE OR REPLACE FUNCTION public.request_withdrawal_v2(_amount numeric, _wallet text, _network text, _currency text, _fee_tx text)
RETURNS public.withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid:=auth.uid(); p public.profiles; result public.withdrawals; pct numeric:=0; fee numeric; tx text:=nullif(trim(coalesce(_fee_tx,'')),'');
BEGIN
IF uid IS NULL THEN RAISE EXCEPTION 'يرجى تسجيل الدخول'; END IF;
IF _network NOT IN ('TRON','BNB','ETHEREUM','SOLANA') THEN RAISE EXCEPTION 'اختر شبكة صحيحة'; END IF;
IF _currency NOT IN ('USDT','USDC','BNB','ETH','SOL','TRX') THEN RAISE EXCEPTION 'اختر عملة صحيحة'; END IF;
IF _amount IS NULL OR _amount < 49 OR _amount <> round(_amount,2) THEN RAISE EXCEPTION 'الحد الأدنى للسحب 49$'; END IF;
IF _wallet IS NULL OR length(trim(_wallet)) NOT BETWEEN 20 AND 200 THEN RAISE EXCEPTION 'عنوان المحفظة غير صالح'; END IF;
IF tx IS NOT NULL AND length(tx) NOT BETWEEN 6 AND 200 THEN RAISE EXCEPTION 'رقم معاملة الرسوم غير صالح'; END IF;
SELECT * INTO p FROM public.profiles WHERE id=uid FOR UPDATE;
IF p.id IS NULL OR NOT p.is_active THEN RAISE EXCEPTION 'الحساب غير مفعّل'; END IF;
IF p.is_banned THEN RAISE EXCEPTION 'الحساب محظور'; END IF;
IF p.balance < _amount THEN RAISE EXCEPTION 'الرصيد غير كافٍ'; END IF;
BEGIN SELECT least(100,greatest(0,value::numeric)) INTO pct FROM public.settings WHERE key='withdraw_fee_percent'; EXCEPTION WHEN others THEN pct:=0; END;
pct:=coalesce(pct,0); fee:=round(_amount*pct/100,2);
INSERT INTO public.withdrawals(user_id,wallet_address,amount,network,currency,fee_percent,fee_amount,fee_wallet,fee_notice,status,fee_status,fee_tx)
VALUES(uid,trim(_wallet),_amount,_network,_currency,pct,fee,coalesce((SELECT value FROM public.settings WHERE key='withdraw_fee_wallet'),''),coalesce((SELECT value FROM public.settings WHERE key='withdraw_fee_notice'),''),
 CASE WHEN fee>0 AND tx IS NOT NULL THEN 'fee_pending' ELSE 'pending' END,
 CASE WHEN fee<=0 THEN 'none' WHEN tx IS NULL THEN 'skipped' ELSE 'pending' END, tx) RETURNING * INTO result;
UPDATE public.profiles SET balance=balance-_amount WHERE id=uid;
RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.request_withdrawal_v2(numeric,text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_v2(numeric,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_transfer_points(_from_user uuid, _to_code text, _amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE receiver_id uuid; receiver_active boolean; sender_balance numeric; sender_active boolean; sender_banned boolean; mn numeric; mx numeric;
BEGIN
  IF _from_user IS NULL THEN RAISE EXCEPTION 'sender_not_found'; END IF;
  IF _to_code !~ '^\d{5}$' THEN RAISE EXCEPTION 'invalid_account_id'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  BEGIN SELECT nullif(value,'')::numeric INTO mn FROM public.settings WHERE key='transfer_min'; EXCEPTION WHEN others THEN mn:=NULL; END;
  BEGIN SELECT nullif(value,'')::numeric INTO mx FROM public.settings WHERE key='transfer_max'; EXCEPTION WHEN others THEN mx:=NULL; END;
  IF mn IS NOT NULL AND mn > 0 AND _amount < mn THEN RAISE EXCEPTION 'transfer_below_min:%', mn; END IF;
  IF mx IS NOT NULL AND mx > 0 AND _amount > mx THEN RAISE EXCEPTION 'transfer_above_max:%', mx; END IF;
  SELECT balance, is_active, is_banned INTO sender_balance, sender_active, sender_banned FROM public.profiles WHERE id = _from_user FOR UPDATE;
  IF sender_balance IS NULL THEN RAISE EXCEPTION 'sender_not_found'; END IF;
  IF COALESCE(sender_banned,false) THEN RAISE EXCEPTION 'sender_banned'; END IF;
  IF NOT COALESCE(sender_active,false) THEN RAISE EXCEPTION 'sender_not_active'; END IF;
  SELECT id, is_active INTO receiver_id, receiver_active FROM public.profiles WHERE referral_code = _to_code;
  IF receiver_id IS NULL THEN RAISE EXCEPTION 'receiver_not_found'; END IF;
  IF receiver_id = _from_user THEN RAISE EXCEPTION 'self_transfer_not_allowed'; END IF;
  IF NOT COALESCE(receiver_active,false) THEN RAISE EXCEPTION 'receiver_not_active'; END IF;
  IF sender_balance < _amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  UPDATE public.profiles SET balance = balance - _amount WHERE id = _from_user;
  UPDATE public.profiles SET balance = balance + _amount WHERE id = receiver_id;
  INSERT INTO public.transfers(from_user, to_user, amount) VALUES (_from_user, receiver_id, _amount);
END; $$;