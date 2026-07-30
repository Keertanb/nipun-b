import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, AllowNull, CreatedAt, UpdatedAt } from 'sequelize-typescript';

@Table({ tableName: 'student_reviews', timestamps: true, underscored: true })
export class StudentReview extends Model {
	@PrimaryKey
	@AutoIncrement
	@Column(DataType.BIGINT)
	id!: number;

	@AllowNull(false)
	@Column({ field: 'student_id', type: DataType.STRING(50) })
	studentId!: string;

	@AllowNull(false)
	@Column({ field: 'school_id', type: DataType.STRING(50) })
	schoolId!: string;

	@AllowNull(false)
	@Column({ field: 'teacher_id', type: DataType.STRING(50) })
	teacherId!: string;

	@AllowNull(false)
	@Column({ field: 'academic_year', type: DataType.STRING(10) })
	academicYear!: string;

	@AllowNull(true)
	@Column({ type: DataType.STRING(10) })
	grade!: string | null;

	@AllowNull(false)
	@Column({ type: DataType.ENUM('Good', 'Average', 'Bad') })
	review!: 'Good' | 'Average' | 'Bad';

	@AllowNull(false)
	@Column({ type: DataType.TEXT, defaultValue: '' })
	remarks!: string;

	@AllowNull(false)
	@Column({ field: 'reviewed_at', type: DataType.DATEONLY })
	reviewedAt!: string;

	@CreatedAt
	@Column({ field: 'created_at', type: DataType.DATE })
	createdAt!: Date;

	@UpdatedAt
	@Column({ field: 'updated_at', type: DataType.DATE })
	updatedAt!: Date;
}

export default StudentReview;
