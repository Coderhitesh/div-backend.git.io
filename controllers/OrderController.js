const Orders = require('../models/OrderModel');
const merchantId = "PGTESTPAYUAT"
const apiKey = "099eb0cd-02cf-4e2a-8aca-3e6c6aff0399"
const crypto = require('crypto');
const axios = require('axios');
async function doPayment(amount, Merchant, transactionId, res, req) {
    try {
        const user = await req.user;
        // console.log(user) // Assuming req.user is a Promise resolving to user data
        const data = {
            merchantId: merchantId,
            merchantTransactionId: transactionId,
            merchantUserId: Merchant,
            name: user.name || "User",
            amount: amount * 100,
            redirectUrl: `${process.env.BACKEND_URL}/api/status/${transactionId}}`,
            redirectMode: 'POST',
            paymentInstrument: {
                type: 'PAY_PAGE'
            }
        };
        const payload = JSON.stringify(data);
        const payloadMain = Buffer.from(payload).toString('base64');
        const keyIndex = 1;
        const string = payloadMain + '/pg/v1/pay' + apiKey;
        const sha256 = crypto.createHash('sha256').update(string).digest('hex');
        const checksum = sha256 + '###' + keyIndex;
        const prod_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay";
        console.log(checksum)
        const options = {
            method: 'POST',
            url: prod_URL,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum
            },
            data: {
                request: payloadMain
            }
        };

        const response = await axios.request(options);
        console.log(response.data);
        return response.data;
    } catch (error) {
        console.log(error);
        // Handle error
    }
}

exports.CreateOrder = async (req, res) => {
    try {

        const { items, finalPrice, UserInfo, PaymentMode, UserDeliveryAddress } = req.body
        if (items.length > 0) {
            return res.status(403).json({
                success: true,
                msg: "Please Add Products"
            })
        }
        if (!finalPrice || !UserInfo || !PaymentMode || !UserDeliveryAddress) {
            return res.status(403).json({
                success: true,
                msg: "Please Fill All Fields "
            })
        }

        //if All is ok
        if (PaymentMode === "Online") {
            function generateMerchantTransactionId() {
                const allowedCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                const idLength = 25;
                let transactionId = '';

                for (let i = 0; i < idLength; i++) {
                    const randomIndex = Math.floor(Math.random() * allowedCharacters.length);
                    transactionId += allowedCharacters.charAt(randomIndex);
                }

                return transactionId;
            }
            function MerchantId() {
                const allowedCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                const idLength = 25;
                let MerchantIds = '';

                for (let i = 0; i < idLength; i++) {
                    const randomIndex = Math.floor(Math.random() * allowedCharacters.length);
                    MerchantIds += allowedCharacters.charAt(randomIndex);
                }

                return MerchantIds;
            }

            const transactionId = generateMerchantTransactionId()
            const Merchant = MerchantId()

            const payData = await doPayment(amount, Merchant, transactionId, res, req);

            const redirectUrl = payData.data.instrumentResponse.redirectInfo.url;
            res.redirect(redirectUrl)

        }

        res.status(200).json({
            success: true,
            msg: "Order created successfully"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            msg: "Internal Server Error"
        });
    }
};


exports.checkStatus = async (req, res) => {


    // Extract the merchantTransactionId from the request body
    const { transactionId: merchantTransactionId } = req.body;

    // Check if the merchantTransactionId is available
    if (!merchantTransactionId) {
        return res.status(400).json({ success: false, message: "Merchant transaction ID not provided" });
    }

    // Retrieve the merchant ID from the environment variables or constants
    const merchantId = merchantid;

    // Generate the checksum for authentication
    const keyIndex = 1;
    const string = `/pg/v1/status/${merchantId}/${merchantTransactionId}` + apiKey;
    const sha256 = crypto.createHash('sha256').update(string).digest('hex');
    const checksum = sha256 + "###" + keyIndex;
    // const testUrlCheck = "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1"


    const testUrlCheck = "https://api.phonepe.com/apis/hermes/pg/v1/"

    // Prepare the options for the HTTP request
    const options = {
        method: 'GET',
        url: `${testUrlCheck}/status/${merchantId}/${merchantTransactionId}`,
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'X-VERIFY': checksum,
            'X-MERCHANT-ID': `${merchantId}`
        }
    };

    // Prepare the options for the HTTP  
    // const options = {
    //     method: 'GET',
    //     url: `https://api.phonepe.com/apis/hermes/pg/v1/status/${merchantId}/${merchantTransactionId}`,
    //     headers: {
    //         accept: 'application/json',
    //         'Content-Type': 'application/json',
    //         'X-VERIFY': checksum,
    //         'X-MERCHANT-ID': `${merchantId}`
    //     }
    // };

    // Send the HTTP request to check the payment status
    axios.request(options)
        .then(async (response) => {
            // Check if the payment was successful
            if (response.data.success === true) {
                // Check if the user ID is available
                if (!userId) {
                    return res.status(400).json({ success: false, message: "User ID not available" });
                }

                // Fetch the most recent order associated with the user within a certain timestamp range
                const timestampThreshold = new Date(Date.now() - (24 * 60 * 60 * 1000)); // Example: Orders within the last 24 hours
                const userOrders = await Order.find({ user: userId, createdAt: { $gt: timestampThreshold } })
                    .sort({ createdAt: -1 })
                    .limit(1);

                // Check if any orders are found
                if (!userOrders || userOrders.length === 0) {
                    return res.status(404).json({ success: false, message: "No recent orders found for the user" });
                }

                // Update the order status to "Confirmed"
                const orderId = userOrders[0]._id;
                await Order.findByIdAndUpdate(orderId, { orderStatus: "Confirmed" });

                // Create a new payment entry in the database
                const newPayment = new Payment({
                    user: userId,
                    order: orderId, // Using the retrieved order ID
                    tranxTionId: merchantTransactionId // Assign the merchantTransactionId to the transaction ID field
                });

                // Save the new payment entry to the database
                await newPayment.save();

                // Redirect the user to the success page
                const successRedirectUrl = `${process.env.FRONTEND_URL}/order-confirmed`;
                return res.redirect(successRedirectUrl);
            } else {
                // Check if the user ID is available
                if (!userId) {
                    return res.status(400).json({ success: false, message: "User ID not available" });
                }

                // Fetch the most recent order associated with the user within a certain timestamp range
                const timestampThreshold = new Date(Date.now() - (24 * 60 * 60 * 1000)); // Example: Orders within the last 24 hours
                const userOrders = await Order.find({ user: userId, createdAt: { $gt: timestampThreshold } })
                    .sort({ createdAt: -1 })
                    .limit(1);

                // Check if any orders are found
                if (!userOrders || userOrders.length === 0) {
                    return res.status(404).json({ success: false, message: "No recent orders found for the user" });
                }

                // Update the order status to "Failed"
                const orderId = userOrders[0]._id;
                await Order.findByIdAndUpdate(orderId, { orderStatus: "Failed" });

                // Redirect the user to the failed payment page
                const failedRedirectUrl = `${process.env.FRONTEND_URL}/paymentsuccess/Failed`;
                return res.redirect(failedRedirectUrl);
            }
        })
        .catch((error) => {
            console.error(error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        });

};