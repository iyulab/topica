using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Topica.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddContentQueueFailureFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ErrorMessage",
                table: "ContentQueueItems",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FailedAt",
                table: "ContentQueueItems",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ErrorMessage",
                table: "ContentQueueItems");

            migrationBuilder.DropColumn(
                name: "FailedAt",
                table: "ContentQueueItems");
        }
    }
}
