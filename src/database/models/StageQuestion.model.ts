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
} from 'sequelize-typescript';
import RoundStage from './RoundStage.model';

@Table({ tableName: 'stage_questions', timestamps: true, underscored: true })
export class StageQuestion extends Model {
	@PrimaryKey
	@AutoIncrement
	@Column(DataType.BIGINT)
	id!: number;

	@ForeignKey(() => RoundStage)
	@AllowNull(false)
	@Column({ field: 'stage_id', type: DataType.BIGINT })
	stageId!: number;

	@BelongsTo(() => RoundStage)
	stage?: RoundStage;

	@AllowNull(false)
	@Column({ type: DataType.TEXT })
	prompt!: string;

	@AllowNull(false)
	@Column({ type: DataType.ENUM('Gujarati', 'Maths', 'All'), defaultValue: 'All' })
	subject!: 'Gujarati' | 'Maths' | 'All';

	@AllowNull(false)
	@Column({ field: 'sort_order', type: DataType.INTEGER, defaultValue: 0 })
	sortOrder!: number;

	@AllowNull(true)
	@Column({ field: 'created_by_teacher_id', type: DataType.STRING(50) })
	createdByTeacherId!: string | null;

	@CreatedAt
	@Column({ field: 'created_at', type: DataType.DATE })
	createdAt!: Date;

	@UpdatedAt
	@Column({ field: 'updated_at', type: DataType.DATE })
	updatedAt!: Date;
}

export default StageQuestion;
