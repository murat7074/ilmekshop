import React, { useEffect, useState } from 'react';
import MetaData from '../layout/MetaData';
import { useSelector, useDispatch } from 'react-redux';
import CheckoutSteps from './CheckoutSteps';
import { calculateOrderCost } from '../../helpers/helpers';
import {
  useCreateNewOrderMutation,
  useShopierCheckoutSessionMutation,
} from '../../redux/api/orderApi';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  clearCart,
  removeStockOutItemFromCart,
} from '../../redux/features/cartSlice';

const PaymentMethod = () => {
  const [method, setMethod] = useState('');
  const [errorProductStock, setErrorProductStock] = useState([]);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { shippingInfo, shippingInvoiceInfo, cartItems } = useSelector(
    (state) => state.cart
  );

  const [createNewOrder, { error, isSuccess }] = useCreateNewOrderMutation();

  const [
    shopierCheckoutSession,
    { data: checkoutData, error: checkoutError, isLoading },
  ] = useShopierCheckoutSessionMutation();

  useEffect(() => {
    console.log('checkoutData', checkoutData);
    console.log('checkoutError', checkoutError);

    if (checkoutData) {
      // Create a new window or tab to open the form
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.open();
        newWindow.document.write(checkoutData);
        newWindow.document.close();

        // Submit the form automatically
        const form = newWindow.document.querySelector('form');
        if (form) {
          form.submit();
        }
      }
    }

    if (checkoutError) {
      toast.error(checkoutError?.data?.message);
      const errorData = checkoutError?.data;
      if (errorData && Array.isArray(errorData.errors)) {
        setErrorProductStock(errorData.errors);
        errorData.errors.forEach((err) => {
          const toastMessage = err.msg;
          toast.error(toastMessage);
        });
        toast.error('Sepetinizi Kontrol Ediniz.');
      } else {
        toast.error('Bilinmeyen bir hata oluştu.');
      }
    }
  }, [checkoutData, checkoutError]);

  useEffect(() => {
    if (error) {
      const errorData = error?.data;
      if (errorData && Array.isArray(errorData.errors)) {
        setErrorProductStock(errorData.errors);
        errorData.errors.forEach((err) => {
          const toastMessage = err.msg;
          toast.error(toastMessage);
        });
        toast.error('Sepetinizi Güncelleyin');
      } else {
        toast.error('Bilinmeyen bir hata oluştu.');
      }
    }

    if (isSuccess) {
      toast.success('Sipariş Oluşturuldu.');
      dispatch(clearCart());
      navigate('/me/orders');
    }
  }, [error, isSuccess]);

  useEffect(() => {
    if (errorProductStock?.length > 0) {
      dispatch(removeStockOutItemFromCart(errorProductStock));
      navigate('/cart');
    }
  }, [errorProductStock]);

  const submitHandler = (e) => {
    e.preventDefault();

    const { itemsPrice, shippingPrice, totalPrice } = calculateOrderCost(cartItems);

    if (method === 'COD') {
      const orderData = {
        shippingInfo,
        shippingInvoiceInfo,
        orderItems: cartItems,
        itemsPrice,
        shippingAmount: shippingPrice,
        taxAmount: 0,
        totalAmount: totalPrice,
        paymentInfo: {
          status: 'Not Paid',
        },
        paymentMethod: 'COD',
      };
      createNewOrder(orderData);
    }

    if (method === 'Card') {
      const orderData = {
        shippingInfo,
        shippingInvoiceInfo,
        orderItems: cartItems,
        itemsPrice,
        shippingAmount: shippingPrice,
        taxAmount: 0,
        totalAmount: totalPrice,
      };
      shopierCheckoutSession(orderData);
    }
  };

  return (
    <main className='align-page min-h-screen'>
      <MetaData title={'Ödeme Metodu'} />
      <CheckoutSteps shipping confirmOrder payment />
      <div className='flex justify-center mt-5'>
        <div className='mt-5'>
          <form
            className='flex flex-col shadow-md rounded-md p-4 gap-y-4'
            onSubmit={submitHandler}
          >
            <h2 className='mb-4 font-bold'>Ödeme Metodu Seçiniz</h2>
            <div className='flex gap-x-2'>
              <input
                className='form-check-input'
                type='radio'
                name='payment_mode'
                id='codradio'
                value='COD'
                onChange={(e) => setMethod('COD')}
              />
              <label className='form-check-label' htmlFor='codradio'>
                Kapıda Ödeme
              </label>
            </div>
            <div className='flex gap-x-2'>
              <input
                className='form-check-input'
                type='radio'
                name='payment_mode'
                id='cardradio'
                value='Card'
                onChange={(e) => setMethod('Card')}
              />
              <label className='form-check-label' htmlFor='cardradio'>
                Kredi Kartı - VISA, MasterCard
              </label>
            </div>
            <button
              id='shipping_btn'
              type='submit'
              className='btn btn-primary my-3 w-56'
              disabled={isLoading}
            >
              İLERLE
            </button>
          </form>
        </div>
      </div>
    </main>
  );
};

export default PaymentMethod;


















// import React, { useEffect, useState } from 'react';
// import MetaData from '../layout/MetaData';
// import { useSelector, useDispatch } from 'react-redux';
// import CheckoutSteps from './CheckoutSteps';
// import { calculateOrderCost } from '../../helpers/helpers';
// import {
//   useCreateNewOrderMutation,
//   useShopierCheckoutSessionMutation, // useShopierCheckoutSessionMutation olarak değiştirdim
// } from '../../redux/api/orderApi';
// import { toast } from 'react-hot-toast';
// import { useNavigate } from 'react-router-dom';
// import {
//   clearCart,
//   removeStockOutItemFromCart,
// } from '../../redux/features/cartSlice';

// const PaymentMethod = () => {
//   const [method, setMethod] = useState('');
//   const [errorProductStock, setErrorProductStock] = useState([]);

//   const dispatch = useDispatch();

//   const navigate = useNavigate();

//   const { shippingInfo, shippingInvoiceInfo, cartItems } = useSelector(
//     (state) => state.cart
//   );

//   const [createNewOrder, { error, isSuccess }] = useCreateNewOrderMutation();

//   const [
//     shopierCheckoutSession,
//     { data: checkoutData, error: checkoutError, isLoading },
//   ] = useShopierCheckoutSessionMutation(); // shopierCheckoutSession olarak değiştirdim

//   useEffect(() => {
//     if (checkoutData) {
//       const newWindow = window.open('', '_blank');
//       newWindow.document.open();
//       newWindow.document.write(checkoutData);
//       newWindow.document.close();
//     }

//     if (checkoutError) {
//       toast.error(checkoutError?.data?.message);
//     }

//     if (checkoutError) {
//       const errorData = checkoutError?.data;
//       if (errorData && Array.isArray(errorData.errors)) {
//         setErrorProductStock(errorData.errors);

//         errorData.errors.forEach((err) => {
//           const toastMessage = err.msg;
//           toast.error(toastMessage);
//         });

//         toast.error('Sepetinizi Kontrol Ediniz.');
//       } else {
//         toast.error('Bilinmeyen bir hata oluştu.');
//       }
//     }
//   }, [checkoutData, checkoutError]);

//   useEffect(() => {
//     if (error) {
//       const errorData = error?.data;
//       if (errorData && Array.isArray(errorData.errors)) {
//         setErrorProductStock(errorData.errors);

//         errorData.errors.forEach((err) => {
//           const toastMessage = err.msg;
//           toast.error(toastMessage);
//         });

//         toast.error('Sepetinizi Güncelleyin');
//       } else {
//         toast.error('Bilinmeyen bir hata oluştu.');
//       }
//     }

//     if (isSuccess) {
//       toast.success('Sipariş Oluşturuldu.'); // kapıda ödeme
//       dispatch(clearCart());
//       navigate('/me/orders');
//     }
//   }, [error, isSuccess]);

//   useEffect(() => {
//     if (errorProductStock?.length > 0) {
//       dispatch(removeStockOutItemFromCart(errorProductStock));
//       navigate('/cart');
//     }
//   }, [errorProductStock]);

//   const submitHandler = (e) => {
//     e.preventDefault();

//     const { itemsPrice, shippingPrice, totalPrice } = calculateOrderCost(cartItems);

//     if (method === 'COD') {
//       // Create COD Order
//       const orderData = {
//         shippingInfo,
//         shippingInvoiceInfo,
//         orderItems: cartItems,
//         itemsPrice,
//         shippingAmount: shippingPrice,
//         taxAmount: 0, // backendde hesaplanacak
//         totalAmount: totalPrice,
//         paymentInfo: {
//           status: 'Not Paid',
//         },
//         paymentMethod: 'COD',
//       };

//       createNewOrder(orderData);
//     }

//     if (method === 'Card') {
//       // Shopier Checkout
//       const orderData = {
//         shippingInfo,
//         shippingInvoiceInfo,
//         orderItems: cartItems,
//         itemsPrice,
//         shippingAmount: shippingPrice,
//         taxAmount: 0, // backendde hesaplanacak
//         totalAmount: totalPrice,
//       };

//       shopierCheckoutSession(orderData); // shopierCheckoutSession olarak değiştirdim
//     }
//   };

//   return (
//     <main className='align-page min-h-screen'>
//       <MetaData title={'Ödeme Metodu'} />
//       <CheckoutSteps shipping confirmOrder payment />

//       <div className='flex justify-center mt-5 '>
//         <div className=' mt-5'>
//           <form
//             className='flex flex-col shadow-md rounded-md p-4 gap-y-4 '
//             onSubmit={submitHandler}
//           >
//             <h2 className='mb-4 font-bold'>Ödeme Metodu Seçiniz</h2>

//             <div className='flex gap-x-2'>
//               <input
//                 className='form-check-input'
//                 type='radio'
//                 name='payment_mode'
//                 id='codradio'
//                 value='COD'
//                 onChange={(e) => setMethod('COD')}
//               />
//               <label className='form-check-label' htmlFor='codradio'>
//                 Kapıda Ödeme
//               </label>
//             </div>
//             <div className='flex gap-x-2'>
//               <input
//                 className='form-check-input'
//                 type='radio'
//                 name='payment_mode'
//                 id='cardradio'
//                 value='Card'
//                 onChange={(e) => setMethod('Card')}
//               />
//               <label className='form-check-label' htmlFor='cardradio'>
//                 Kredi Kartı - VISA, MasterCard
//               </label>
//             </div>

//             <button
//               id='shipping_btn'
//               type='submit'
//               className='btn btn-primary my-3 w-56'
//               disabled={isLoading}
//             >
//               İLERLE
//             </button>
//           </form>
//         </div>
//       </div>
//     </main>
//   );
// };

// export default PaymentMethod;





