
import catchAsyncErrors from '../middlewares/catchAsyncErrors.js'
import Order from '../models/order.js'
import Product from '../models/product.js'
import User from '../models/user.js'
import axios from 'axios'
import brevoEmailSender from '../emails/brevoEmailSender.js'
import { orderDetailTemplateForCustomer } from '../emails/emailTemplates/orderDetailTemplateForCustomer.js'
import { orderDetailTemplateForSeller } from '../emails/emailTemplates/orderDetailTemplateForSeller.js'

const SHOPIER_API_URL = 'https://www.shopier.com/ShowProduct/api_pay4.php'
const SHOPIER_API_USER = process.env.SHOPIER_API_USER
const SHOPIER_API_PASSWORD = process.env.SHOPIER_API_PASSWORD

// Create Shopier checkout session => /api/v1/payment/checkout_session
export const shopierCheckoutSession = catchAsyncErrors(
  async (req, res, next) => {
    console.log('Request body:', req.body); // Log the incoming request

    const body = req.body;
    const errors = [];

    for (const item of body.orderItems) {
      const product = await Product.findOne({
        _id: item.product,
        'colors.productColorID': item.productColorID,
      });

      if (!product) {
        errors.push({
          msg: `Ürün bulunamadı: ${item.name}`,
          color: '',
          productColorID: item.productColorID,
        });

        continue; // Bu ürün için işlemi atla ve bir sonraki ürüne geç
      }

      const color = product.colors.find(
        (color) => color.productColorID === item.productColorID
      );

      if (color.colorStock < item.amount) {
        errors.push({
          msg: `Stokta yeterli miktarda ürün yok: ${item.name}`,
          color: color.color,
          productColorID: item.productColorID,
        });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const totalAmount = body.orderItems.reduce(
      (acc, item) => acc + item.price * item.amount,
      0
    );

    const shippingInfo = body?.shippingInfo;
    const shippingInvoiceInfo = body?.shippingInvoiceInfo;
    const shippingInvoiceInfoString = JSON.stringify(shippingInvoiceInfo);

    const requestData = {
      API_key: SHOPIER_API_USER,
      API_secret: SHOPIER_API_PASSWORD,
      platform_order_id: req.user._id.toString(),
      total_amount: totalAmount,
      currency: 'TRY',
      customer_email: req.user.email,
      customer_first_name: 'Murat',
      customer_last_name: 'YÖNEV',
      customer_address: shippingInfo.address,
      customer_city: shippingInfo.city,
      customer_country: shippingInfo.country,
      customer_phone: shippingInfo.phoneNo,
      customer_zip_code: shippingInfo.zipCode,
      success_url: `${process.env.FRONTEND_URL}/me/orders/shopier-success`,
      fail_url: `${process.env.FRONTEND_URL}`,
    };

    console.log("requestData",requestData);

    try {
      const response = await axios.post(SHOPIER_API_URL, requestData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      console.log('Shopier response data:', response.data); // Log the Shopier response

      if (response.data) {
        res.status(200).send(response.data);
      } else {
        res.status(500).json({
          success: false,
          message: 'Shopier ödeme bağlantısı oluşturulamadı.',
        });
      }
    } catch (error) {
      console.error(
        'Shopier API Error: ',
        error.response ? error.response.data : error.message
      );
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// Webhook for Shopier => /api/v1/payment/webhook
export const shopierWebhook = catchAsyncErrors(async (req, res, next) => {
  try {
    const { status, platform_order_id, payment_id, total_amount } = req.body

    if (status !== 'success') {
      return res
        .status(400)
        .json({ success: false, message: 'Payment not successful' })
    }

    const orderItems = JSON.parse(req.body.order_items)
    const user = platform_order_id

    const totalAmount = parseFloat(total_amount)
    const taxAmount = totalAmount * 0.08 // Assuming 8% tax
    const shippingAmount = req.body.shipping_amount || 0
    const itemsPrice = totalAmount - taxAmount - shippingAmount

    const shippingInfo = {
      address: req.body.customer_address,
      city: req.body.customer_city,
      phoneNo: req.body.customer_phone,
      zipCode: req.body.customer_zip_code,
      country: req.body.customer_country,
      userName:
        req.body.customer_first_name + ' ' + req.body.customer_last_name,
    }

    const paymentInfo = {
      id: payment_id,
      status: status,
    }

    const orderData = {
      shippingInfo,
      orderItems,
      itemsPrice,
      taxAmount,
      shippingAmount,
      totalAmount,
      paymentInfo,
      paymentMethod: 'Card',
      user,
    }

    const order = await Order.create(orderData)

    // Sipariş oluşturulduktan sonra stok ve renk stok güncelleme işlemleri
    for (const item of order.orderItems) {
      const product = await Product.findById(item.product)

      if (product) {
        for (const colorItem of item.colors) {
          const productColor = product.colors.find(
            (color) => color.color === colorItem.color
          )

          if (productColor) {
            productColor.colorStock -= item.amount
          }
        }

        product.stock -= item.amount

        await Product.findByIdAndUpdate(
          item.product,
          { $set: { stock: product.stock, colors: product.colors } },
          { new: true, runValidators: true }
        )
      }
    }

    // SEND EMAIL TO USER

    const orderProducts = order.orderItems
    const orderInfo = {
      itemsPrice: order?.orderItems
        ?.reduce((acc, item) => acc + item.price * item.amount, 0)
        .toFixed(2),
      taxAmount: order.taxAmount,
      shippingAmount: order.shippingAmount,
      totalAmount: order.totalAmount,
      orderNumber: order._id,
      paymentMethod: order.paymentMethod,
    }

    const userShippingInfo = order.shippingInfo

    const message = orderDetailTemplateForCustomer(
      userShippingInfo,
      orderInfo,
      orderProducts
    )

    const userInfo = await User.findOne({ _id: user })

    await brevoEmailSender({
      email: userInfo.email,
      subject: 'Beybuilmek Sipariş Verildi.',
      message,
      name: userInfo.name,
    })

    // SEND EMAIL TO SELLER

    const sellerEmail = 'beybuilmek@gmail.com'
    const sellerName = 'beybuilmek'

    const messageForSeller = orderDetailTemplateForSeller(
      userShippingInfo,
      orderInfo,
      orderProducts
    )

    await brevoEmailSender({
      email: sellerEmail,
      subject: 'Beybuilmek Sipariş Verildi.',
      message: messageForSeller,
      name: sellerName,
    })

    res.status(200).json({ success: true })
  } catch (error) {
    console.log('Error => ', error)
    res.status(400).send(`Webhook Error: ${error.message}`)
  }
})









// import catchAsyncErrors from '../middlewares/catchAsyncErrors.js'
// import Order from '../models/order.js'
// import Product from '../models/product.js'
// import User from '../models/user.js'
// import axios from 'axios'
// import brevoEmailSender from '../emails/brevoEmailSender.js'
// import { orderDetailTemplateForCustomer } from '../emails/emailTemplates/orderDetailTemplateForCustomer.js'
// import { orderDetailTemplateForSeller } from '../emails/emailTemplates/orderDetailTemplateForSeller.js'

// const SHOPIER_API_URL = 'https://www.shopier.com/ShowProduct/api_pay4.php'
// const SHOPIER_API_USER = process.env.SHOPIER_API_USER
// const SHOPIER_API_PASSWORD = process.env.SHOPIER_API_PASSWORD

// // Create Shopier checkout session => /api/v1/payment/checkout_session
// export const shopierCheckoutSession = catchAsyncErrors(
//   async (req, res, next) => {
//     const body = req.body
//     const errors = []

//     // 2. Adım: Sipariş Edilen Ürünleri Kontrol Etme
//     for (const item of body.orderItems) {
//       const product = await Product.findOne({
//         _id: item.product,
//         'colors.productColorID': item.productColorID,
//       })

//       if (!product) {
//         errors.push({
//           msg: `Ürün bulunamadı: ${item.name}`,
//           color: '',
//           productColorID: item.productColorID,
//         })

//         continue // Bu ürün için işlemi atla ve bir sonraki ürüne geç
//       }

//       const color = product.colors.find(
//         (color) => color.productColorID === item.productColorID
//       )

//       if (color.colorStock < item.amount) {
//         errors.push({
//           msg: `Stokta yeterli miktarda ürün yok: ${item.name}`,
//           color: color.color,
//           productColorID: item.productColorID,
//         })
//       }
//     }

//     if (errors.length > 0) {
//       return res.status(400).json({ success: false, errors })
//     }

//     const totalAmount = body.orderItems.reduce(
//       (acc, item) => acc + item.price * item.amount,
//       0
//     )

//     const shippingInfo = body?.shippingInfo
//     const shippingInvoiceInfo = body?.shippingInvoiceInfo
//     const shippingInvoiceInfoString = JSON.stringify(shippingInvoiceInfo)

//     const requestData = {
//       API_key: SHOPIER_API_USER,
//       API_secret: SHOPIER_API_PASSWORD,
//       platform_order_id: req.user._id.toString(),
//       total_amount: totalAmount,
//       currency: 'TRY',
//       customer_email: req.user.email,
//       customer_first_name: 'Murat',
//       customer_last_name: 'YÖNEV',
//       customer_address: shippingInfo.address,
//       customer_city: shippingInfo.city,
//       customer_country: shippingInfo.country,
//       customer_phone: shippingInfo.phoneNo,
//       customer_zip_code: shippingInfo.zipCode,
//       success_url: `${process.env.FRONTEND_URL}/me/orders/shopier-success`,
//       fail_url: `${process.env.FRONTEND_URL}`,
//     }

//     try {
//       const response = await axios.post(SHOPIER_API_URL, requestData, {
//         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//       })

//       if (response.data) {
//         console.log('Shopier response data:', response.data) // Hata ayıklama için log ekleyin
//         res.status(200).send(response.data)
//       } else {
//         res.status(500).json({
//           success: false,
//           message: 'Shopier ödeme bağlantısı oluşturulamadı.',
//         })
//       }
//     } catch (error) {
//       console.error(
//         'Shopier API Error: ',
//         error.response ? error.response.data : error.message
//       ) // Hata ayıklama için logla
//       res.status(500).json({ success: false, message: error.message })
//     }
//   }
// )

// // Webhook for Shopier => /api/v1/payment/webhook
// export const shopierWebhook = catchAsyncErrors(async (req, res, next) => {
//   try {
//     const { status, platform_order_id, payment_id, total_amount } = req.body

//     if (status !== 'success') {
//       return res
//         .status(400)
//         .json({ success: false, message: 'Payment not successful' })
//     }

//     const orderItems = JSON.parse(req.body.order_items)
//     const user = platform_order_id

//     const totalAmount = parseFloat(total_amount)
//     const taxAmount = totalAmount * 0.08 // Assuming 8% tax
//     const shippingAmount = req.body.shipping_amount || 0
//     const itemsPrice = totalAmount - taxAmount - shippingAmount

//     const shippingInfo = {
//       address: req.body.customer_address,
//       city: req.body.customer_city,
//       phoneNo: req.body.customer_phone,
//       zipCode: req.body.customer_zip_code,
//       country: req.body.customer_country,
//       userName:
//         req.body.customer_first_name + ' ' + req.body.customer_last_name,
//     }

//     const paymentInfo = {
//       id: payment_id,
//       status: status,
//     }

//     const orderData = {
//       shippingInfo,
//       orderItems,
//       itemsPrice,
//       taxAmount,
//       shippingAmount,
//       totalAmount,
//       paymentInfo,
//       paymentMethod: 'Card',
//       user,
//     }

//     const order = await Order.create(orderData)

//     // Sipariş oluşturulduktan sonra stok ve renk stok güncelleme işlemleri
//     for (const item of order.orderItems) {
//       const product = await Product.findById(item.product)

//       if (product) {
//         for (const colorItem of item.colors) {
//           const productColor = product.colors.find(
//             (color) => color.color === colorItem.color
//           )

//           if (productColor) {
//             productColor.colorStock -= item.amount
//           }
//         }

//         product.stock -= item.amount

//         await Product.findByIdAndUpdate(
//           item.product,
//           { $set: { stock: product.stock, colors: product.colors } },
//           { new: true, runValidators: true }
//         )
//       }
//     }

//     // SEND EMAIL TO USER

//     const orderProducts = order.orderItems
//     const orderInfo = {
//       itemsPrice: order?.orderItems
//         ?.reduce((acc, item) => acc + item.price * item.amount, 0)
//         .toFixed(2),
//       taxAmount: order.taxAmount,
//       shippingAmount: order.shippingAmount,
//       totalAmount: order.totalAmount,
//       orderNumber: order._id,
//       paymentMethod: order.paymentMethod,
//     }

//     const userShippingInfo = order.shippingInfo

//     const message = orderDetailTemplateForCustomer(
//       userShippingInfo,
//       orderInfo,
//       orderProducts
//     )

//     const userInfo = await User.findOne({ _id: user })

//     await brevoEmailSender({
//       email: userInfo.email,
//       subject: 'Beybuilmek Sipariş Verildi.',
//       message,
//       name: userInfo.name,
//     })

//     // SEND EMAIL TO SELLER

//     const sellerEmail = 'beybuilmek@gmail.com'
//     const sellerName = 'beybuilmek'

//     const messageForSeller = orderDetailTemplateForSeller(
//       userShippingInfo,
//       orderInfo,
//       orderProducts
//     )

//     await brevoEmailSender({
//       email: sellerEmail,
//       subject: 'Beybuilmek Sipariş Verildi.',
//       message: messageForSeller,
//       name: sellerName,
//     })

//     res.status(200).json({ success: true })
//   } catch (error) {
//     console.log('Error => ', error)
//     res.status(400).send(`Webhook Error: ${error.message}`)
//   }
// })
