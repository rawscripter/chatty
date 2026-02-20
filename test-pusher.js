const PushNotifications = require('@pusher/push-notifications-server');
require('dotenv').config({ path: '.env.local' });

const beamsClient = new PushNotifications({
  instanceId: process.env.NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID,
  secretKey: process.env.PUSHER_BEAMS_SECRET_KEY
});

async function checkAndroid() {
  try {
    // Publish a test directly to the Web and FCM channnels using the generic interest
    const res = await beamsClient.publishToInterests(['hello'], {
      web: { notification: { title: "Test", body: "Web Test" } },
      fcm: { notification: { title: "Test", body: "FCM Test" } }
    });
    console.log("Publish Response:", res);
  } catch (e) {
    console.error("Error:", e);
  }
}
checkAndroid();
