import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(config.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2023-10-16',
    });
  }

  async createCheckoutSession(userId: string, userEmail: string) {
    const priceId = this.config.get('STRIPE_PREMIUM_PRICE_ID');

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: userEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.config.get('FRONTEND_URL')}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.config.get('FRONTEND_URL')}/premium`,
      metadata: { userId },
      subscription_data: {
        metadata: { userId },
      },
    });

    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.config.get('STRIPE_WEBHOOK_SECRET');
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Webhook imzası geçersiz.');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.deleted':
      case 'invoice.payment_failed':
        await this.handleSubscriptionEnded(event.data.object as any);
        break;
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    if (!userId) return;

    // İdempotency: zaten premium mi?
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role === 'premium') return;

    const subscription = await this.stripe.subscriptions.retrieve(
      session.subscription as string,
    );

    const periodEnd = new Date(subscription.current_period_end * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: 'premium',
        subscriptionStart: new Date(),
        subscriptionEnd: periodEnd,
      },
    });
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const userId = (invoice.subscription_details?.metadata as any)?.userId;
    if (!userId) return;

    const subscription = await this.stripe.subscriptions.retrieve(
      invoice.subscription as string,
    );

    const periodEnd = new Date(subscription.current_period_end * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: 'premium',
        subscriptionEnd: periodEnd,
      },
    });
  }

  private async handleSubscriptionEnded(obj: any) {
    const userId = obj?.metadata?.userId;
    if (!userId) return;

    await this.prisma.user.update({
      where: { id: userId },
      data: { role: 'free' },
      // claimedPlayerId korunur
    });
  }
}
