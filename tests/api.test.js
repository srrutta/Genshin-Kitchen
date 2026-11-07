import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app, { getOrderStatus } from '../server.js';

let server;
let baseUrl;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

describe('Express API', () => {
  it('serves grouped restaurants and real local menu images', async () => {
    const response = await fetch(`${baseUrl}/api/restaurants`);
    const { restaurants } = await response.json();
    expect(response.status).toBe(200);
    expect(restaurants.length).toBeGreaterThan(0);
    expect(restaurants[0].dishNames.length).toBeGreaterThan(0);

    const goodHunter = restaurants.find((restaurant) => restaurant.name === 'Good Hunter');
    expect(goodHunter.coverImage).toBe('/shop-images/Good-Hunter.webp');
    const shopImageResponse = await fetch(`${baseUrl}${goodHunter.coverImage}`);
    expect(shopImageResponse.status).toBe(200);
    expect(shopImageResponse.headers.get('content-type')).toContain('image/webp');

    expect(restaurants).toHaveLength(28);
    for (const restaurant of restaurants) {
      expect(restaurant.coverImage, `${restaurant.name} shop image`).toMatch(/^\/shop-images\//);
      const imageResponse = await fetch(`${baseUrl}${restaurant.coverImage}`);
      expect(imageResponse.status, `${restaurant.name} image response`).toBe(200);
      expect(imageResponse.headers.get('content-type')).toContain('image/webp');
    }

    const menuResponse = await fetch(`${baseUrl}/api/restaurants/${restaurants[0].id}/menu`);
    const menu = await menuResponse.json();
    expect(menuResponse.status).toBe(200);
    expect(menu.menuOfDay.length).toBeLessThanOrEqual(3);
    expect(menu.dishes[0].image).toMatch(/^\/images\//);

    const allMenuResponse = await fetch(`${baseUrl}/api/menu`);
    const { items } = await allMenuResponse.json();
    const sakuraShrimpCrackers = items.find((item) => item.name === 'Sakura Shrimp Crackers');
    expect(sakuraShrimpCrackers.image).toBe('/images/Item_Sakura_Shrimp_Crackers.webp');
    const sakuraImageResponse = await fetch(`${baseUrl}${sakuraShrimpCrackers.image}`);
    expect(sakuraImageResponse.status).toBe(200);
    expect(sakuraImageResponse.headers.get('content-type')).toContain('image/webp');
  });

  it('serves all Restaurant Zorya dishes with effect and rarity metadata', async () => {
    const response = await fetch(`${baseUrl}/api/restaurants`);
    const { restaurants } = await response.json();
    const zorya = restaurants.find((restaurant) => restaurant.name === 'Restaurant Zorya');

    expect(zorya).toMatchObject({
      nation: 'snezhnaya',
      type: 'restaurant',
      coverImage: '/shop-images/Restaurant_Zorya.webp',
    });
    const restaurantImageResponse = await fetch(`${baseUrl}${zorya.coverImage}`);
    expect(restaurantImageResponse.status).toBe(200);
    expect(restaurantImageResponse.headers.get('content-type')).toContain('image/webp');

    const menuResponse = await fetch(`${baseUrl}/api/restaurants/${zorya.id}/menu`);
    const { dishes } = await menuResponse.json();
    expect(dishes).toHaveLength(5);
    for (const dish of dishes) {
      expect(dish.image).toMatch(/^\/images\//);
      const foodImageResponse = await fetch(`${baseUrl}${dish.image}`);
      expect(foodImageResponse.status).toBe(200);
      expect(foodImageResponse.headers.get('content-type')).toContain('image/webp');
    }
    expect(dishes.map(({ name, effect, rarity }) => ({ name, effect, rarity }))).toEqual([
      { name: 'Glupov Rye Bread', effect: 'recovery', rarity: 2 },
      { name: 'Snowball Blooms Atop Snowfields', effect: 'atk', rarity: 3 },
      { name: 'Rimecurrant Ice Cream', effect: 'recovery', rarity: 3 },
      { name: 'Snezhnaya Shashliks', effect: 'adventurer', rarity: 3 },
      { name: 'Zharkoye', effect: 'recovery', rarity: 3 },
    ]);
    expect(dishes.find(({ name }) => name === 'Rimecurrant Ice Cream').category).toBe('dessert');
  });

  it('calculates the receipt on the server and rejects a repeated cancellation', async () => {
    const restaurantsResponse = await fetch(`${baseUrl}/api/restaurants`);
    const { restaurants } = await restaurantsResponse.json();
    const restaurant = restaurants[0];
    const menuResponse = await fetch(`${baseUrl}/api/restaurants/${restaurant.id}/menu`);
    const { dishes } = await menuResponse.json();
    const dish = dishes[0];

    const createResponse = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: '8801',
        nation: restaurant.nation,
        restaurantId: restaurant.id,
        method: 'cod',
        items: [{ id: dish.id, qty: 2 }],
      }),
    });
    const { order } = await createResponse.json();
    expect(createResponse.status).toBe(201);
    expect(order.subtotal).toBe(dish.price * 2);
    expect(order.total).toBe(order.subtotal + order.deliveryFee);
    expect(order.status).toBe('Pending');
    expect(order.cancelable).toBe(true);

    const cancelResponse = await fetch(`${baseUrl}/api/orders/${order.id}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: '8801' }),
    });
    expect(cancelResponse.status).toBe(200);
    expect((await cancelResponse.json()).order.status).toBe('Cancelled');

    const repeatedResponse = await fetch(`${baseUrl}/api/orders/${order.id}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: '8801' }),
    });
    expect(repeatedResponse.status).toBe(409);
  });

  it('advances order status using server timestamps', () => {
    const order = { createdAt: 0, eta: 15, cancelledAt: null };
    const at = (seconds) => getOrderStatus(order, seconds * 1000);
    expect([at(0), at(20), at(30), at(55), at(70)]).toEqual([
      'Pending', 'Accepted', 'Preparing', 'Leading', 'Completed',
    ]);
  });
});
