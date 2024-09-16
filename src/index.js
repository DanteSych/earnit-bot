const telegramAuthToken = '';
const webhookEndpoint = "/endpoint";
addEventListener("fetch", event => {
  event.respondWith(handleIncomingRequest(event));
});

async function handleIncomingRequest(event) {
  let url = new URL(event.request.url);
  let path = url.pathname;
  let method = event.request.method;
  let workerUrl = `${url.protocol}//${url.host}`;

  if (method === "POST" && path === webhookEndpoint) {
    const update = await event.request.json();
    event.waitUntil(processUpdate(update));
    return new Response("Ok");
  } else if (method === "GET" && path === "/configure-webhook") {
    const url = `https://api.telegram.org/bot${telegramAuthToken}/setWebhook?url=${workerUrl}${webhookEndpoint}`;

    const response = await fetch(url);

    if (response.ok) {
      return new Response("Webhook set successfully", { status: 200 });
    } else {
      return new Response("Failed to set webhook", { status: response.status });
    }
  } else {
    return new Response("Bot is ready!", { status: 404 });
  }
}

async function processUpdate(update) {
  if ("message" in update) {
    const chatId = update.message.chat.id;
    const messageText = update.message.text;

    if (messageText === '/start') {
      // Extract user information
      const telegramId = update.message.from.id;
      const username = update.message.from.username || 'anonymous';
      const firstName = update.message.from.first_name || '';
      const lastName = update.message.from.last_name || '';
      const telegramName = `${firstName} ${lastName}`.trim();

      console.log(`telegram_id: ${telegramId}, username: ${username}, telegram_name: ${telegramName}`);

      let profilePhotoUrl = '';

      try {
        // Get user profile photos
        const userProfilePhotosResponse = await fetch(`https://api.telegram.org/bot${telegramAuthToken}/getUserProfilePhotos?user_id=${telegramId}`);
        const userProfilePhotos = await userProfilePhotosResponse.json();

        if (userProfilePhotos.ok && userProfilePhotos.result.total_count > 0) {
          // Get the file_id of the first photo
          const fileId = userProfilePhotos.result.photos[0][0].file_id;

          // Get the file path
          const fileResponse = await fetch(`https://api.telegram.org/bot${telegramAuthToken}/getFile?file_id=${fileId}`);
          const file = await fileResponse.json();

          if (file.ok) {
            profilePhotoUrl = `https://api.telegram.org/file/bot${telegramAuthToken}/${file.result.file_path}`;
            console.log(`Profile photo URL for user ${telegramName} (${telegramId}): ${profilePhotoUrl}`);
          }
        } else {
          console.log(`No profile photo found for user ${telegramName} (${telegramId})`);
        }
      } catch (error) {
        console.error('Error fetching user profile photos:', error);
      }

      // Construct the web app URL with the retrieved user details
      const webAppUrl = `https://earnit-game.netlify.app/?telegram_id=${telegramId}&username=${username}&telegram_name=${encodeURIComponent(telegramName)}&profile_photo_url=${encodeURIComponent(profilePhotoUrl)}`;

      // Send a welcome message with an inline keyboard
      const responseText = 'Welcome to Earnit Game!';
      const replyMarkup = {
        inline_keyboard: [
          [{ text: 'Start the Game!', web_app: { url: webAppUrl } }]
        ]
      };

      const sendMessageUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage`;
      const sendMessageResponse = await fetch(sendMessageUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          reply_markup: replyMarkup
        })
      });

      if (!sendMessageResponse.ok) {
        console.error('Failed to send message:', await sendMessageResponse.text());
      }
    }
  }
}