// Nợ tiền của khách hàng = nợ đầu kỳ (customers.current_debt, nhập từ file) + phần chưa thu của các đơn
// đã hoàn thành nghĩa vụ. Biểu thức dưới đây dùng trong câu SELECT có alias bảng khách hàng là `c`.
export const ORDER_DEBT_EXPR = `COALESCE((SELECT SUM(o.total_amount - COALESCE(ret.returned_amount, 0) - o.paid_amount + COALESCE(ret.refund_amount, 0))
      FROM orders o
      LEFT JOIN (SELECT order_id, SUM(returned_amount) AS returned_amount, SUM(refund_amount) AS refund_amount
                   FROM order_returns GROUP BY order_id) ret ON ret.order_id = o.id
     WHERE o.customer_id = c.id
       AND o.order_status IN ('COMPLETED', 'RETURNED')
       AND o.order_type IN ('SALE', 'BORROW_IN')
       AND (o.total_amount - COALESCE(ret.returned_amount, 0) - o.paid_amount + COALESCE(ret.refund_amount, 0)) > 0.5), 0)`;

export const TOTAL_DEBT_EXPR = `(COALESCE(c.current_debt, 0) + ${ORDER_DEBT_EXPR})`;
