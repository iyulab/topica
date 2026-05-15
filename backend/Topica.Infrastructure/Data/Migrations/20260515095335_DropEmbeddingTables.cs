using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Topica.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class DropEmbeddingTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ResearchChunkEmbeddings");

            migrationBuilder.DropTable(
                name: "TopicEmbeddings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ResearchChunkEmbeddings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TopicId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ChunkIndex = table.Column<int>(type: "INTEGER", nullable: false),
                    ChunkText = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Model = table.Column<string>(type: "TEXT", nullable: false),
                    Vector = table.Column<byte[]>(type: "BLOB", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResearchChunkEmbeddings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ResearchChunkEmbeddings_Topics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "Topics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TopicEmbeddings",
                columns: table => new
                {
                    TopicId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Model = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Vector = table.Column<byte[]>(type: "BLOB", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TopicEmbeddings", x => x.TopicId);
                    table.ForeignKey(
                        name: "FK_TopicEmbeddings_Topics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "Topics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ResearchChunkEmbeddings_TopicId",
                table: "ResearchChunkEmbeddings",
                column: "TopicId");
        }
    }
}
