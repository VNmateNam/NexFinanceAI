/**
 * Alert Checker — runs every 3 minutes via cron
 * Checks all active price alerts and triggers notifications
 */

import { supabase } from './supabase';
import { getCommodityPrices, getStockPrice } from './priceService';
import { sendEmailAlert, sendSMSAlert } from './notificationService';
import { logger } from './logger';

export async function checkAlerts() {
  // Fetch all active alerts
  const { data: alerts, error } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('is_active', true);

  if (error || !alerts?.length) return;

  // Get all unique symbols
  const symbols = [...new Set(alerts.map((a: any) => a.symbol))];

  // Fetch current prices
  const priceMap: Record<string, number> = {};
  const commodities = await getCommodityPrices();
  for (const c of commodities) priceMap[c.symbol] = c.price;

  // Fetch stock prices for non-commodity symbols
  for (const sym of symbols) {
    if (!priceMap[sym]) {
      const stock = await getStockPrice(sym);
      if (stock) priceMap[sym] = stock.price;
    }
  }

  // Evaluate each alert
  for (const alert of alerts as any[]) {
    const currentPrice = priceMap[alert.symbol];
    if (!currentPrice) continue;

    let triggered = false;
    let conditionText = '';

    switch (alert.condition) {
      case 'above':
        triggered = currentPrice >= alert.target_value;
        conditionText = `Price rose above $${alert.target_value}`;
        break;
      case 'below':
        triggered = currentPrice <= alert.target_value;
        conditionText = `Price fell below $${alert.target_value}`;
        break;
      case 'percent_up':
        // target_value is % change threshold
        triggered = ((currentPrice - (alert.current_value || currentPrice)) / (alert.current_value || currentPrice)) * 100 >= alert.target_value;
        conditionText = `Price rose by ${alert.target_value}%`;
        break;
      case 'percent_down':
        triggered = ((( alert.current_value || currentPrice) - currentPrice) / (alert.current_value || currentPrice)) * 100 >= alert.target_value;
        conditionText = `Price fell by ${alert.target_value}%`;
        break;
    }

    if (!triggered) {
      // Update current value for percent tracking
      await supabase.from('price_alerts')
        .update({ current_value: currentPrice })
        .eq('id', alert.id);
      continue;
    }

    logger.info(`Alert triggered: ${alert.asset_name} ${conditionText} @ $${currentPrice}`);

    // Deactivate alert (one-time trigger)
    await supabase.from('price_alerts').update({
      is_active: false,
      triggered_at: new Date().toISOString(),
    }).eq('id', alert.id);

    // Log to history
    await supabase.from('alert_history').insert({
      alert_id: alert.id,
      user_id: alert.user_id,
      symbol: alert.symbol,
      message: `${alert.asset_name} ${conditionText}`,
      price_at_trigger: currentPrice,
      notification_sent: false,
      channel: alert.notify_email && alert.notify_sms ? 'both' : alert.notify_email ? 'email' : 'sms',
    });

    // Send notifications
    const subject = `🔔 NexusAI: ${alert.asset_name} alert triggered`;
    const notifyParams = {
      assetName: alert.asset_name,
      symbol: alert.symbol,
      condition: conditionText,
      targetValue: alert.target_value,
      currentPrice,
    };

    if (alert.notify_email && alert.contact_email) {
      await sendEmailAlert({ to: alert.contact_email, subject, ...notifyParams });
    }
    if (alert.notify_sms && alert.contact_phone) {
      await sendSMSAlert({ to: alert.contact_phone, ...notifyParams });
    }

    // Mark notification as sent
    await supabase.from('alert_history')
      .update({ notification_sent: true })
      .eq('alert_id', alert.id);
  }
}
