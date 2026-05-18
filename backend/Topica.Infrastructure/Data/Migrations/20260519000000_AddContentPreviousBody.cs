using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Topica.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddContentPreviousBody : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PreviousBody",
                table: "Contents",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PreviousBody",
                table: "Contents");
        }
    }
}
