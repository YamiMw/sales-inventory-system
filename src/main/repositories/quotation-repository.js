/**
 * Quotation Repository
 * Provides database access for quotation records.
 */

const { getDatabase } = require('../database/connection');

class QuotationRepository {
  async create(quotationData) {
    const db = getDatabase();
    
    return await db.transaction(async (trx) => {
      const [quotationId] = await trx('quotations').insert({
        quote_number: quotationData.quoteNumber,
        customer_id: quotationData.customerId,
        quote_date: quotationData.quoteDate,
        expiry_date: quotationData.expiryDate,
        subtotal: quotationData.subtotal,
        discount_amount: quotationData.discountAmount,
        tax_amount: quotationData.taxAmount,
        total_amount: quotationData.totalAmount,
        status: 'draft',
        notes: quotationData.notes,
        terms: quotationData.terms,
        created_by: quotationData.userId,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      });

      for (const item of quotationData.items) {
        await trx('quotation_items').insert({
          quotation_id: quotationId,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_percent: item.discountPercent || 0,
          total_price: item.quantity * item.unitPrice * (1 - (item.discountPercent || 0) / 100),
          is_backorder: item.isBackorder || false
        });
      }

      return this.findById(quotationId);
    });
  }

  async findAll(filters = {}) {
    const db = getDatabase();
    let query = db('quotations')
      .select(
        'quotations.*',
        'customers.name as customer_name'
      )
      .leftJoin('customers', 'quotations.customer_id', 'customers.id')
      .orderBy('quotations.created_at', 'desc');

    if (filters.status) {
      query = query.where('quotations.status', filters.status);
    }

    if (filters.customerId) {
      query = query.where('quotations.customer_id', filters.customerId);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    return await query.limit(limit).offset(offset);
  }

  async findById(id) {
    const db = getDatabase();
    
    const quotation = await db('quotations')
      .select(
        'quotations.*',
        'customers.name as customer_name',
        'customers.email as customer_email',
        'customers.phone as customer_phone',
        'customers.address as customer_address'
      )
      .leftJoin('customers', 'quotations.customer_id', 'customers.id')
      .where('quotations.id', id)
      .first();

    if (!quotation) return null;

    quotation.items = await db('quotation_items')
      .select(
        'quotation_items.*',
        'products.name as product_name',
        'products.sku'
      )
      .join('products', 'quotation_items.product_id', 'products.id')
      .where('quotation_id', id);

    return quotation;
  }

  async updateStatus(id, status) {
    const db = getDatabase();
    await db('quotations')
      .where('id', id)
      .update({
        status,
        updated_at: db.fn.now()
      });
    return this.findById(id);
  }

  async generatePDF(quotation) {
    // PDF generation logic - simplified for this example
    return {
      filename: `${quotation.quote_number}.pdf`,
      data: `PDF data for quotation ${quotation.quote_number}`
    };
  }
}

module.exports = new QuotationRepository();