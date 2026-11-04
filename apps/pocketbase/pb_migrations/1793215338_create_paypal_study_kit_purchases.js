/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		const lectures = app.findCollectionByNameOrId('lectures');
		const purchases = new Collection({
			type: 'base',
			name: 'paypal_study_kit_purchases',
			listRule: null,
			viewRule: null,
			createRule: null,
			updateRule: null,
			deleteRule: null,
			indexes: [
				'CREATE UNIQUE INDEX `idx_paypal_study_kit_order` ON `paypal_study_kit_purchases` (`order_id`) WHERE `order_id` != ""',
				'CREATE UNIQUE INDEX `idx_paypal_study_kit_active_owner_lecture_product` ON `paypal_study_kit_purchases` (`user`, `lecture`, `product_key`) WHERE `status` IN ("creating", "created", "captured")',
				'CREATE INDEX `idx_paypal_study_kit_owner_lecture` ON `paypal_study_kit_purchases` (`user`, `lecture`, `product_key`)',
			],
			fields: [
				{
					name: 'user',
					type: 'relation',
					required: true,
					maxSelect: 1,
					collectionId: users.id,
					cascadeDelete: false,
				},
				{
					name: 'lecture',
					type: 'relation',
					required: true,
					maxSelect: 1,
					collectionId: lectures.id,
					cascadeDelete: false,
				},
				{ name: 'order_id', type: 'text', max: 64 },
				{ name: 'capture_id', type: 'text', max: 64 },
				{ name: 'approval_url', type: 'url', max: 255 },
				{ name: 'product_key', type: 'text', required: true, max: 100 },
				{ name: 'status', type: 'select', required: true, values: ['creating', 'created', 'captured', 'failed'], maxSelect: 1 },
				{ name: 'amount', type: 'number', required: true, min: 0 },
				{ name: 'currency', type: 'text', required: true, max: 3 },
				{
					name: 'booster_status',
					type: 'select',
					required: true,
					values: ['not_started', 'generating', 'failed', 'ready'],
					maxSelect: 1,
				},
				{ name: 'booster_output', type: 'json' },
				{ name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
			],
		});

		app.save(purchases);
	},
	(app) => {
		const purchases = app.findCollectionByNameOrId('paypal_study_kit_purchases');
		app.delete(purchases);
	},
);
