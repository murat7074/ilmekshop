import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const orderApi = createApi({
  reducerPath: 'orderApi',

  baseQuery: fetchBaseQuery({
   baseUrl:'https://ilmekshop.onrender.com/api/v1',

}),

   tagTypes: ['Order', 'MyOrder', 'AdminOrders', 'User', 'Products'],
  endpoints: (builder) => ({
    createNewOrder: builder.mutation({
      query(body) {
        return {
          url: '/orders/new',
          method: 'POST',
          body,
        }
      },
      invalidatesTags: ['Product', 'AdminProducts', 'MyOrder', 'Order'],
    }),

    myOrders: builder.query({
      query: () => `/me/orders`,
      providesTags: ['Order'],
    }),

    orderDetails: builder.query({
      query: (id) => `/orders/${id}`,
      providesTags: ['MyOrder'],
    }),

    // shopierCheckoutSession: builder.mutation({
    //   query(body) {
    //     return {
    //       url: '/payment/checkout_session',
    //       method: 'POST',
    //       body,
    //     }
    //   },
    // }),

      shopierCheckoutSession: builder.mutation({
      query: (orderData) => ({
        url: '/payment/checkout_session',
        method: 'POST',
        body: orderData,
        responseHandler: 'text', // Response'u text olarak işle
      }),
    }),
    getDashboardSales: builder.query({
      query: ({ startDate, endDate }) =>
        `/admin/get_sales/?startDate=${startDate}&endDate=${endDate}`,
    }),
    getAdminOrders: builder.query({
      query: () => `/admin/orders`,
      providesTags: ['AdminOrders'],
    }),

    updateOrder: builder.mutation({
      query({ id, body }) {
     
        return {
          url: `/admin/orders/${id}`,
          method: 'PUT',
          body,
        }
      },
      invalidatesTags: ['Order', 'AdminOrders', 'MyOrder', 'Products'],
    }),

    returnOrderRequest: builder.mutation({
      query({ id, body }) {
        return {
          url: `/me/order-return/${id}`,
          method: 'POST',
          body,
        }
      },
      invalidatesTags: ['Order', 'AdminOrders', 'MyOrder', 'User'],
    }),

    deleteOrder: builder.mutation({
      query({ body, id }) {
      
        return {
          url: `/admin/orders/${id}`,
          method: 'DELETE',
          body,
        }
      },
      invalidatesTags: ['Order', 'AdminOrders', 'MyOrder', 'User'],
    }),
  }),
})

export const {
  useCreateNewOrderMutation,
  useShopierCheckoutSessionMutation,
  useMyOrdersQuery,
  useOrderDetailsQuery,
  useLazyGetDashboardSalesQuery,
  useGetAdminOrdersQuery,
  useUpdateOrderMutation,
  useDeleteOrderMutation,
  useReturnOrderRequestMutation,
} = orderApi
