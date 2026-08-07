import {
	Table,
	Column,
	Model,
	DataType,
	PrimaryKey,
	AutoIncrement,
	AllowNull,
	CreatedAt,
	UpdatedAt,
	ForeignKey,
	BelongsTo,
	HasMany,
} from 'sequelize-typescript';
import ReviewRound from './ReviewRound.model';

@Table({ tableName: 'round_stages', timestamps: true, underscored: true })
export class RoundStage extends Model {
	@PrimaryKey
	@AutoIncrement
	@Column(DataType.BIGINT)
	id!: number;

	@ForeignKey(() => ReviewRound)
	@AllowNull(false)
	@Column({ field: 'round_id', type: DataType.BIGINT })
	roundId!: number;

	@BelongsTo(() => ReviewRound)
	round?: ReviewRound;

	@AllowNull(false)
	@Column({ type: DataType.STRING(40) })
	code!: string;

	@AllowNull(false)
	@Column({ type: DataType.STRING(100) })
	name!: string;

	@AllowNull(false)
	@Column({ type: DataType.TEXT, defaultValue: '' })
	description!: string;

	@AllowNull(false)
	@Column({ field: 'sort_order', type: DataType.INTEGER, defaultValue: 0 })
	sortOrder!: number;

	@AllowNull(false)
	@Column({ field: 'stage_type', type: DataType.ENUM('assessment', 'intervention', 'summary'), defaultValue: 'assessment' })
	stageType!: 'assessment' | 'intervention' | 'summary';

	@CreatedAt
	@Column({ field: 'created_at', type: DataType.DATE })
	createdAt!: Date;

	@UpdatedAt
	@Column({ field: 'updated_at', type: DataType.DATE })
	updatedAt!: Date;
}

export default RoundStage;
